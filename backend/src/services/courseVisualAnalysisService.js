import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import OpenAI from 'openai';
import { assertHttpSource } from './mediaClipperService.js';

const VISION_MODEL = process.env.COURSE_FACTORY_VISION_MODEL || 'gpt-4o-mini';
const DEFAULT_INTERVAL_SECONDS = Number(process.env.COURSE_FACTORY_VISUAL_INTERVAL_SECONDS) || 120;
const DEFAULT_MAX_FRAMES = Number(process.env.COURSE_FACTORY_VISUAL_MAX_FRAMES) || 36;
const PROCESS_TIMEOUT_MS = Number(process.env.COURSE_FACTORY_VISUAL_PROCESS_TIMEOUT_MS) || 120000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'no-key' });

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildSampleTimestamps(durationSeconds, options = {}) {
  const duration = Math.max(0, Number(durationSeconds) || 0);
  if (duration <= 0) return [0];
  const interval = clamp(Number(options.intervalSeconds) || DEFAULT_INTERVAL_SECONDS, 15, 3600);
  const maxFrames = clamp(Number(options.maxFrames) || DEFAULT_MAX_FRAMES, 1, 120);
  const naturalCount = Math.floor(duration / interval) + 1;

  if (naturalCount <= maxFrames) {
    const points = [];
    for (let value = 0; value < duration; value += interval) points.push(Math.round(value));
    if (points.at(-1) !== Math.round(duration)) points.push(Math.round(duration));
    return points.slice(0, maxFrames);
  }

  if (maxFrames === 1) return [0];
  const step = duration / (maxFrames - 1);
  return Array.from({ length: maxFrames }, (_, index) => Math.round(index * step));
}

export function normalizeVisualObservation(raw = {}) {
  return {
    timestampSeconds: Math.max(0, Number(raw.timestampSeconds) || 0),
    observation: String(raw.observation || '').trim().slice(0, 1500),
    stage: String(raw.stage || 'unclassified').trim().slice(0, 120),
    confidence: clamp(Number(raw.confidence) || 0.5, 0, 1),
    provenance: {
      kind: 'ai_inference',
      reviewRequired: true,
      source: 'sampled_video_frame',
    },
  };
}

function runProcess(command, args, timeoutMs = PROCESS_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout = (stdout + chunk.toString()).slice(-10000); });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-10000); });
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
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

async function probeDuration(sourceUrl) {
  const source = assertHttpSource(sourceUrl);
  const { stdout } = await runProcess('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    source,
  ], 60000);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Unable to determine source video duration');
  return duration;
}

async function extractFrame(sourceUrl, timestampSeconds, workspace, index) {
  const source = assertHttpSource(sourceUrl);
  const framePath = path.join(workspace, `frame-${String(index).padStart(4, '0')}.jpg`);
  await runProcess('ffmpeg', [
    '-y',
    '-ss', String(timestampSeconds),
    '-i', source,
    '-frames:v', '1',
    '-vf', 'scale=768:-2',
    '-q:v', '5',
    framePath,
  ]);
  const bytes = await fsp.readFile(framePath);
  return { path: framePath, dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}` };
}

function parseJsonObject(content) {
  const text = String(content || '');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function analyseBatch(frames, context = {}) {
  const content = [{
    type: 'text',
    text: [
      'Analyse these sampled frames from a long-form expert demonstration.',
      'Return JSON only with an observations array in the same order as the images.',
      'Each observation must include observation, stage, confidence from 0 to 1.',
      'Describe only what is visibly supportable. Do not invent tool names, materials, safety facts, intent, or technique rationale when the image does not prove them.',
      'The result is AI inference and will require creator review.',
      `Project: ${String(context.name || '').slice(0, 300)}`,
      `Audience: ${String(context.targetAudience || '').slice(0, 600)}`,
      `Desired outcome: ${String(context.desiredOutcome || '').slice(0, 800)}`,
      `Timestamps: ${frames.map((frame) => frame.timestampSeconds).join(', ')}`,
    ].join('\n'),
  }];

  for (const frame of frames) {
    content.push({ type: 'image_url', image_url: { url: frame.dataUrl, detail: 'low' } });
  }

  const response = await openai.chat.completions.create({
    model: VISION_MODEL,
    temperature: 0.1,
    messages: [{ role: 'user', content }],
  });
  const parsed = parseJsonObject(response.choices?.[0]?.message?.content);
  const raw = Array.isArray(parsed?.observations) ? parsed.observations : [];
  return frames.map((frame, index) => normalizeVisualObservation({
    ...raw[index],
    timestampSeconds: frame.timestampSeconds,
    observation: raw[index]?.observation || 'No reliable visual observation returned for this sampled frame.',
    confidence: raw[index]?.confidence ?? 0.1,
  }));
}

class CourseVisualAnalysisService {
  async analyse({ sourceUrl, durationSeconds, name, targetAudience, desiredOutcome }) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'no-key') {
      throw new Error('OPENAI_API_KEY is required for visual analysis of silent footage');
    }
    const source = assertHttpSource(sourceUrl);
    const duration = Number(durationSeconds) > 0 ? Number(durationSeconds) : await probeDuration(source);
    const timestamps = buildSampleTimestamps(duration);
    const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'trillionai-course-visual-'));
    const observations = [];

    try {
      const batchSize = clamp(Number(process.env.COURSE_FACTORY_VISUAL_BATCH_SIZE) || 4, 1, 8);
      for (let offset = 0; offset < timestamps.length; offset += batchSize) {
        const batchTimestamps = timestamps.slice(offset, offset + batchSize);
        const frames = [];
        for (let index = 0; index < batchTimestamps.length; index += 1) {
          const timestampSeconds = batchTimestamps[index];
          const extracted = await extractFrame(source, timestampSeconds, workspace, offset + index);
          frames.push({ ...extracted, timestampSeconds });
        }
        observations.push(...await analyseBatch(frames, { name, targetAudience, desiredOutcome }));
      }

      return {
        generatedAt: new Date().toISOString(),
        model: VISION_MODEL,
        durationSeconds: Math.round(duration),
        sampledFrames: timestamps.length,
        observations,
        provenance: {
          kind: 'ai_inference',
          reviewRequired: true,
          note: 'Visual observations are machine interpretations of sampled frames and must be reviewed by the creator before publication.',
        },
      };
    } finally {
      await fsp.rm(workspace, { recursive: true, force: true });
    }
  }
}

export default new CourseVisualAnalysisService();
