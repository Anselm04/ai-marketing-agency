import axios from 'axios';
import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { isS3Configured, uploadToS3, getPrivateSignedDownloadUrl } from './uploadService.js';

const PROCESS_TIMEOUT_MS = Number(process.env.MEDIA_COMPOSE_TIMEOUT_MS) || 15 * 60 * 1000;
const MAX_ASSETS = Number(process.env.MEDIA_COMPOSE_MAX_ASSETS) || 20;
const MAX_DOWNLOAD_BYTES = Number(process.env.MEDIA_COMPOSE_MAX_SOURCE_BYTES) || 300 * 1024 * 1024;

const PRESETS = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};

function run(command, args, timeoutMs = PROCESS_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-12000);
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve({ code });
      else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-3000)}`));
    });
  });
}

function extensionFor(mimetype = '') {
  if (mimetype === 'image/jpeg') return '.jpg';
  if (mimetype === 'image/png') return '.png';
  if (mimetype === 'image/webp') return '.webp';
  if (mimetype === 'image/gif') return '.gif';
  if (mimetype === 'video/quicktime') return '.mov';
  if (mimetype === 'video/webm') return '.webm';
  return mimetype.startsWith('video/') ? '.mp4' : '.bin';
}

async function downloadAsset(asset, destination) {
  const sourceUrl = asset.storageKey
    ? await getPrivateSignedDownloadUrl(asset.storageKey, 15 * 60)
    : asset.url;
  if (!sourceUrl) throw new Error(`Asset ${asset.id} has no readable source`);

  const response = await axios.get(sourceUrl, {
    responseType: 'arraybuffer',
    timeout: 60_000,
    maxRedirects: 3,
    maxContentLength: MAX_DOWNLOAD_BYTES,
    maxBodyLength: MAX_DOWNLOAD_BYTES,
  });
  const buffer = Buffer.from(response.data);
  if (!buffer.length) throw new Error(`Asset ${asset.id} downloaded as an empty file`);
  if (buffer.length > MAX_DOWNLOAD_BYTES) throw new Error(`Asset ${asset.id} exceeds the compose size limit`);
  await fsp.writeFile(destination, buffer);
}

class MediaComposerService {
  async compose({ ownerId, assets, aspectRatio = '9:16', secondsPerImage = 3, maxVideoSeconds = 12 }) {
    if (!Array.isArray(assets) || assets.length === 0) throw new Error('Select at least one media asset');
    if (assets.length > MAX_ASSETS) throw new Error(`A maximum of ${MAX_ASSETS} assets can be composed at once`);
    if (!isS3Configured()) throw new Error('Durable S3-compatible storage is required to generate a reusable video');

    const preset = PRESETS[aspectRatio] || PRESETS['9:16'];
    const imageSeconds = Math.max(1, Math.min(Number(secondsPerImage) || 3, 10));
    const videoSeconds = Math.max(2, Math.min(Number(maxVideoSeconds) || 12, 60));
    const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'trillionai-media-compose-'));
    const segments = [];

    try {
      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index];
        const sourcePath = path.join(workspace, `source-${index}${extensionFor(asset.mimetype)}`);
        const segmentPath = path.join(workspace, `segment-${index}.mp4`);
        await downloadAsset(asset, sourcePath);

        const visualFilter = `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=increase,crop=${preset.width}:${preset.height},fps=30,format=yuv420p`;

        if (String(asset.mimetype || '').startsWith('image/')) {
          await run('ffmpeg', [
            '-y',
            '-loop', '1',
            '-i', sourcePath,
            '-t', String(imageSeconds),
            '-vf', visualFilter,
            '-an',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '23',
            '-movflags', '+faststart',
            segmentPath,
          ]);
        } else if (String(asset.mimetype || '').startsWith('video/')) {
          await run('ffmpeg', [
            '-y',
            '-i', sourcePath,
            '-t', String(videoSeconds),
            '-vf', visualFilter,
            '-an',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '23',
            '-movflags', '+faststart',
            segmentPath,
          ]);
        } else {
          throw new Error(`Unsupported media type for asset ${asset.id}`);
        }

        segments.push(segmentPath);
      }

      const concatFile = path.join(workspace, 'concat.txt');
      await fsp.writeFile(
        concatFile,
        segments.map((segment) => `file '${segment.replace(/'/g, "'\\''")}'`).join('\n'),
        'utf8',
      );

      const outputPath = path.join(workspace, 'output.mp4');
      await run('ffmpeg', [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFile,
        '-c', 'copy',
        '-movflags', '+faststart',
        outputPath,
      ]);

      const output = await fsp.readFile(outputPath);
      const key = `media-library/${ownerId}/generated/${Date.now()}-${crypto.randomUUID()}.mp4`;
      const url = await uploadToS3(key, output, 'video/mp4');

      return {
        url,
        key,
        mimetype: 'video/mp4',
        size: output.length,
        aspectRatio,
        sourceAssetIds: assets.map((asset) => asset.id),
        generatedAt: new Date().toISOString(),
      };
    } finally {
      await fsp.rm(workspace, { recursive: true, force: true });
    }
  }
}

export default new MediaComposerService();
