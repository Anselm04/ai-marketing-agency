import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { isS3Configured, uploadToS3 } from './uploadService.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'no-key',
});

const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1';
const MAX_SOURCE_SECONDS = Number(process.env.CLIPPING_MAX_SOURCE_SECONDS) || 4 * 60 * 60;
const TRANSCRIPTION_CHUNK_SECONDS = Number(process.env.CLIPPING_TRANSCRIPTION_CHUNK_SECONDS) || 15 * 60;
const PROCESS_TIMEOUT_MS = Number(process.env.CLIPPING_PROCESS_TIMEOUT_MS) || 15 * 60 * 1000;

function configuredSourceHosts() {
  const hosts = String(process.env.CLIPPING_SOURCE_HOST_ALLOWLIST || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  if (process.env.S3_PUBLIC_BASE_URL) {
    try {
      hosts.push(new URL(process.env.S3_PUBLIC_BASE_URL).hostname.toLowerCase());
    } catch {
      // Environment validation elsewhere will surface malformed storage configuration.
    }
  }

  return [...new Set(hosts)];
}

function hostAllowed(hostname, allowlist) {
  const host = hostname.toLowerCase();
  return allowlist.some((allowed) => {
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1);
      return host.endsWith(suffix) && host.length > suffix.length;
    }
    return host === allowed;
  });
}

export function assertHttpSource(sourceUrl) {
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error('Source URL must be a valid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Source URL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Source URL credentials are not allowed');
  }

  const host = parsed.hostname.toLowerCase();
  const blockedHosts = new Set(['localhost', 'localhost.localdomain', '0.0.0.0', '::1']);
  const privateIpv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
  if (blockedHosts.has(host) || privateIpv4.test(host)) {
    throw new Error('Private or loopback source URLs are not allowed');
  }

  const allowlist = configuredSourceHosts();
  if (process.env.NODE_ENV === 'production') {
    if (allowlist.length === 0) {
      throw new Error('CLIPPING_SOURCE_HOST_ALLOWLIST or S3_PUBLIC_BASE_URL is required in production');
    }
    if (!hostAllowed(host, allowlist)) {
      throw new Error('Source URL host is not approved for production clipping');
    }
  } else if (allowlist.length > 0 && !hostAllowed(host, allowlist)) {
    throw new Error('Source URL host is not in CLIPPING_SOURCE_HOST_ALLOWLIST');
  }

  return parsed.toString();
}

function runProcess(command, args, { timeoutMs = PROCESS_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      child.kill('SIGKILL');
      settled = true;
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-12000);
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`${command} failed to start: ${error.message}`));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ code, stderr });
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-3000)}`));
      }
    });
  });
}

async function probeDuration(sourceUrl) {
  const source = assertHttpSource(sourceUrl);
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      source,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => child.kill('SIGKILL'), 60_000);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`ffprobe failed to start: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Number.parseFloat(stdout.trim());
      if (code !== 0 || !Number.isFinite(duration) || duration <= 0) {
        reject(new Error(`Unable to read source duration: ${stderr.slice(-1000) || 'invalid duration'}`));
        return;
      }
      resolve(Math.min(duration, MAX_SOURCE_SECONDS));
    });
  });
}

function formatSegment(start, end, text) {
  return `[${Math.max(0, start).toFixed(2)}s-${Math.max(start, end).toFixed(2)}s] ${String(text || '').trim()}`;
}

class MediaClipperService {
  isRendererAvailable() {
    return true;
  }

  isDurableStorageConfigured() {
    return isS3Configured();
  }

  async transcribeSource(sourceUrl) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'no-key') {
      throw new Error('OPENAI_API_KEY is required for automatic source transcription');
    }

    const source = assertHttpSource(sourceUrl);
    const durationSeconds = await probeDuration(source);
    const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'trillionai-transcribe-'));
    const lines = [];
    let chunks = 0;

    try {
      for (let start = 0; start < durationSeconds; start += TRANSCRIPTION_CHUNK_SECONDS) {
        const length = Math.min(TRANSCRIPTION_CHUNK_SECONDS, durationSeconds - start);
        const audioPath = path.join(workspace, `chunk-${chunks}.mp3`);

        await runProcess('ffmpeg', [
          '-y',
          '-ss', String(start),
          '-i', source,
          '-t', String(length),
          '-vn',
          '-ac', '1',
          '-ar', '16000',
          '-b:a', '64k',
          audioPath,
        ]);

        const response = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioPath),
          model: TRANSCRIPTION_MODEL,
          response_format: 'verbose_json',
          timestamp_granularities: ['segment'],
        });

        if (Array.isArray(response.segments) && response.segments.length) {
          for (const segment of response.segments) {
            lines.push(formatSegment(
              start + Number(segment.start || 0),
              start + Number(segment.end || segment.start || 0),
              segment.text,
            ));
          }
        } else if (response.text) {
          lines.push(formatSegment(start, start + length, response.text));
        }

        chunks += 1;
        await fsp.rm(audioPath, { force: true });
      }

      return {
        transcript: lines.join('\n'),
        durationSeconds: Math.round(durationSeconds),
        chunks,
        model: TRANSCRIPTION_MODEL,
      };
    } finally {
      await fsp.rm(workspace, { recursive: true, force: true });
    }
  }

  async renderClip({ sourceUrl, startSeconds, endSeconds, ownerId, campaignId, clipId }) {
    const source = assertHttpSource(sourceUrl);
    const start = Math.max(0, Number(startSeconds) || 0);
    const end = Math.max(start + 1, Number(endSeconds) || start + 30);
    const duration = Math.min(end - start, 180);

    if (process.env.NODE_ENV === 'production' && !isS3Configured()) {
      throw new Error('Durable S3-compatible storage is required for production clip rendering');
    }

    const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'trillionai-clip-'));
    const filename = `${clipId || randomUUID()}.mp4`;
    const outputPath = path.join(workspace, filename);

    try {
      await runProcess('ffmpeg', [
        '-y',
        '-ss', String(start),
        '-i', source,
        '-t', String(duration),
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
        '-movflags', '+faststart',
        outputPath,
      ]);

      const stat = await fsp.stat(outputPath);
      if (stat.size <= 0) throw new Error('Rendered clip is empty');

      if (isS3Configured()) {
        const key = `clipping/${ownerId}/${campaignId}/${filename}`;
        const body = await fsp.readFile(outputPath);
        const mediaUrl = await uploadToS3(key, body, 'video/mp4');
        return {
          mediaUrl,
          storage: 's3',
          key,
          size: stat.size,
          durationSeconds: Math.round(duration),
        };
      }

      const retainedDir = path.join(process.env.UPLOAD_DIR || './uploads', String(ownerId), 'clipping', String(campaignId));
      await fsp.mkdir(retainedDir, { recursive: true });
      const retainedPath = path.join(retainedDir, filename);
      await fsp.copyFile(outputPath, retainedPath);
      return {
        mediaUrl: null,
        storage: 'local',
        localPath: retainedPath,
        size: stat.size,
        durationSeconds: Math.round(duration),
      };
    } finally {
      await fsp.rm(workspace, { recursive: true, force: true });
    }
  }
}

export default new MediaClipperService();
