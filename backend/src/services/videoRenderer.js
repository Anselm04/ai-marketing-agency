import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { videoScriptFromBrief } from './marketingEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mediaRoot = path.join(__dirname, '..', '..', 'data', 'media');

function findFont() {
  const candidates = [
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  ];
  return candidates.find((p) => fs.existsSync(p)) || '';
}

function ffEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\u2019")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/\n/g, ' ')
    .slice(0, 48);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-800) || `ffmpeg exit ${code}`));
    });
  });
}

export function userMediaDir(userId) {
  const dir = path.join(mediaRoot, String(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function renderShortVideo({ product, audience, description, ownerId, videoId }) {
  const script = videoScriptFromBrief({ product, audience, description, ownerId });
  const dir = userMediaDir(ownerId);
  const filename = `${videoId}.mp4`;
  const outPath = path.join(dir, filename);
  const font = findFont();
  const duration = script.durationSec || 8;

  const filters = [];
  script.scenes.forEach((scene, i) => {
    const start = scene.t;
    const end = i + 1 < script.scenes.length ? script.scenes[i + 1].t : duration;
    const cap = ffEscape(scene.caption);
    const sub = ffEscape(scene.sub);
    const fontOpt = font ? `:fontfile=${font}` : '';
    filters.push(
      `drawtext=text='${cap}'${fontOpt}:fontsize=52:fontcolor=0xc4a35a:x=(w-text_w)/2:y=h*0.38:enable='between(t,${start},${end})'`
    );
    filters.push(
      `drawtext=text='${sub}'${fontOpt}:fontsize=28:fontcolor=0xe8d5a3:x=(w-text_w)/2:y=h*0.52:enable='between(t,${start},${end})'`
    );
  });

  try {
    await run('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', `color=c=0x0a0c11:s=1080x1920:d=${duration}:r=30`,
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-vf', filters.join(','),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
      '-movflags', '+faststart',
      outPath,
    ]);
  } catch (err) {
    // Minimal valid-ish MPEG-4 via ffmpeg without drawtext, then fallback error
    try {
      await run('ffmpeg', [
        '-y',
        '-f', 'lavfi', '-i', `color=c=0x0a0c11:s=720x1280:d=${duration}:r=24`,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        outPath,
      ]);
    } catch (err2) {
      throw new Error(`Video render failed (install ffmpeg): ${err.message}`);
    }
  }

  const stat = fs.statSync(outPath);
  return {
    path: outPath,
    filename,
    size: stat.size,
    mime: 'video/mp4',
    durationSec: duration,
    script,
  };
}

export function videoFilePath(ownerId, videoId) {
  return path.join(userMediaDir(ownerId), `${videoId}.mp4`);
}

export default { renderShortVideo, videoFilePath, userMediaDir };
