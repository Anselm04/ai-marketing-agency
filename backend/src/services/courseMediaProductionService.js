import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertHttpSource } from './mediaClipperService.js';
import { isS3Configured, uploadToS3 } from './uploadService.js';

const PROCESS_TIMEOUT_MS = Number(process.env.COURSE_FACTORY_RENDER_TIMEOUT_MS) || 60 * 60 * 1000;
const MAX_LESSON_SECONDS = Number(process.env.COURSE_FACTORY_MAX_LESSON_SECONDS) || 90 * 60;

function safeText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'lesson';
}

export function normalizeSourceSegments(segments = [], sourceDurationSeconds = null) {
  const sourceDuration = Number(sourceDurationSeconds) > 0 ? Number(sourceDurationSeconds) : Number.POSITIVE_INFINITY;
  const normalized = (Array.isArray(segments) ? segments : []).map((segment) => {
    const startSeconds = Math.max(0, Number(segment?.startSeconds) || 0);
    const proposedEnd = Number(segment?.endSeconds);
    const endSeconds = Math.min(
      sourceDuration,
      Number.isFinite(proposedEnd) && proposedEnd > startSeconds ? proposedEnd : startSeconds + 30,
    );
    return {
      startSeconds: Math.round(startSeconds * 100) / 100,
      endSeconds: Math.round(endSeconds * 100) / 100,
      purpose: safeText(segment?.purpose || 'demonstration', 300),
    };
  }).filter((segment) => segment.endSeconds > segment.startSeconds);

  normalized.sort((a, b) => a.startSeconds - b.startSeconds);
  return normalized.slice(0, 30);
}

function deriveSegmentsFromEvidence(lesson = {}, sourceDurationSeconds) {
  if (Array.isArray(lesson.sourceSegments) && lesson.sourceSegments.length) {
    return normalizeSourceSegments(lesson.sourceSegments, sourceDurationSeconds);
  }

  const evidence = Array.isArray(lesson.sourceEvidence) ? lesson.sourceEvidence : [];
  const inferred = evidence
    .filter((item) => Number.isFinite(Number(item?.timestampSeconds)))
    .map((item) => {
      const timestamp = Math.max(0, Number(item.timestampSeconds) || 0);
      return {
        startSeconds: Math.max(0, timestamp - 15),
        endSeconds: timestamp + 45,
        purpose: safeText(item.note || 'source evidence', 300),
      };
    });
  return normalizeSourceSegments(inferred, sourceDurationSeconds);
}

function evidenceLooksUninformative(segments = []) {
  if (!segments.length) return true;
  return segments.every((segment) => segment.startSeconds === 0 && segment.endSeconds <= 60);
}

function getSourceRef(project = {}) {
  if (project.sourceUrl) return { kind: 'http', url: project.sourceUrl };
  if (project.upload?.status === 'complete' && project.upload?.key && project.upload?.privateBucket === true) {
    return { kind: 'private_object', key: project.upload.key };
  }
  return null;
}

export function buildLessonRenderPlan(project = {}) {
  if (project.approval?.status !== 'approved') {
    throw new Error('Course must be approved before lesson video rendering.');
  }
  const sourceRef = getSourceRef(project);
  if (!sourceRef) throw new Error('A source video is required before lesson video rendering.');
  const modules = Array.isArray(project.coursePackage?.modules) ? project.coursePackage.modules : [];
  const flattened = [];

  for (const module of modules) {
    for (const lesson of Array.isArray(module.lessons) ? module.lessons : []) {
      flattened.push({ module, lesson });
    }
  }

  const sourceDuration = Number(project.sourceDurationSeconds) || 0;
  const fallbackPartitionSize = sourceDuration > 0 && flattened.length > 0
    ? sourceDuration / flattened.length
    : 0;
  const lessons = [];
  let reviewRequired = false;

  flattened.forEach(({ module, lesson }, index) => {
    let segments = deriveSegmentsFromEvidence(lesson, sourceDuration);
    const shouldPartition = fallbackPartitionSize > 0 && evidenceLooksUninformative(segments);
    if (shouldPartition) {
      const startSeconds = Math.round((fallbackPartitionSize * index) * 100) / 100;
      const endSeconds = Math.round((index === flattened.length - 1 ? sourceDuration : fallbackPartitionSize * (index + 1)) * 100) / 100;
      segments = [{
        startSeconds,
        endSeconds,
        purpose: 'automatic source partition — creator review required',
      }];
      reviewRequired = true;
    }
    if (!segments.length) return;

    const totalSegmentSeconds = Math.round(segments.reduce((sum, segment) => sum + (segment.endSeconds - segment.startSeconds), 0));
    const durationSeconds = Math.min(MAX_LESSON_SECONDS, totalSegmentSeconds);
    lessons.push({
      id: safeText(lesson.id, 120) || randomUUID(),
      moduleId: safeText(module.id, 120),
      moduleTitle: safeText(module.title, 200),
      title: safeText(lesson.title, 200) || 'Course lesson',
      segments,
      durationSeconds,
      outputAspect: '16:9',
      outputResolution: '1920x1080',
      status: 'planned',
      reviewRequired: shouldPartition || lesson?.provenance?.reviewRequired === true,
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    ...(sourceRef.kind === 'http' ? { sourceUrl: sourceRef.url } : {}),
    sourceRef,
    lessons,
    reviewRequired: reviewRequired || lessons.some((lesson) => lesson.reviewRequired),
    note: 'Only creator-approved course structure is eligible for lesson rendering. Automatically partitioned source ranges remain review-required.',
  };
}

function runProcess(command, args, timeoutMs = PROCESS_TIMEOUT_MS) {
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

    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-16000); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`${command} failed to start: ${error.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-3000)}`));
    });
  });
}

async function renderSegment(sourceUrl, segment, outputPath) {
  const duration = segment.endSeconds - segment.startSeconds;
  await runProcess('ffmpeg', [
    '-y',
    '-ss', String(segment.startSeconds),
    '-i', sourceUrl,
    '-t', String(duration),
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '22',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

async function concatenateSegments(segmentPaths, concatFile, outputPath) {
  const list = segmentPaths.map((filePath) => `file '${filePath.replaceAll("'", "'\\''")}'`).join('\n');
  await fsp.writeFile(concatFile, `${list}\n`, 'utf8');
  await runProcess('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFile,
    '-c', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

class CourseMediaProductionService {
  buildRenderPlan(project) {
    return buildLessonRenderPlan(project);
  }

  async renderLesson({ project, lessonPlan, ownerId }) {
    const sourceUrl = assertHttpSource(project.sourceUrl);
    if (process.env.NODE_ENV === 'production' && !isS3Configured()) {
      throw new Error('Durable S3-compatible storage is required for production Course Factory rendering.');
    }
    if (!lessonPlan?.segments?.length) throw new Error('Lesson has no approved source segments to render.');

    const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'trillionai-course-render-'));
    const lessonSlug = slug(lessonPlan.title || lessonPlan.id);
    const outputFilename = `${lessonSlug}-${randomUUID()}.mp4`;
    const outputPath = path.join(workspace, outputFilename);

    try {
      const segmentPaths = [];
      for (let index = 0; index < lessonPlan.segments.length; index += 1) {
        const segmentPath = path.join(workspace, `segment-${String(index + 1).padStart(3, '0')}.mp4`);
        await renderSegment(sourceUrl, lessonPlan.segments[index], segmentPath);
        segmentPaths.push(segmentPath);
      }

      if (segmentPaths.length === 1) {
        await fsp.copyFile(segmentPaths[0], outputPath);
      } else {
        await concatenateSegments(segmentPaths, path.join(workspace, 'concat.txt'), outputPath);
      }

      const stat = await fsp.stat(outputPath);
      if (stat.size <= 0) throw new Error('Rendered course lesson is empty.');

      if (isS3Configured()) {
        const key = `course-factory/${slug(ownerId)}/${slug(project.id)}/lessons/${outputFilename}`;
        const body = await fsp.readFile(outputPath);
        const mediaUrl = await uploadToS3(key, body, 'video/mp4');
        return {
          lessonId: lessonPlan.id,
          mediaUrl,
          storage: 's3',
          storageKey: key,
          size: stat.size,
          durationSeconds: lessonPlan.durationSeconds,
          renderedAt: new Date().toISOString(),
          status: mediaUrl ? 'ready' : 'rendered',
        };
      }

      const retainedDir = path.join(process.env.UPLOAD_DIR || './uploads', String(ownerId), 'course-factory', String(project.id));
      await fsp.mkdir(retainedDir, { recursive: true });
      const retainedPath = path.join(retainedDir, outputFilename);
      await fsp.copyFile(outputPath, retainedPath);
      return {
        lessonId: lessonPlan.id,
        mediaUrl: null,
        storage: 'local',
        localPath: retainedPath,
        size: stat.size,
        durationSeconds: lessonPlan.durationSeconds,
        renderedAt: new Date().toISOString(),
        status: 'rendered_local',
      };
    } finally {
      await fsp.rm(workspace, { recursive: true, force: true });
    }
  }
}

export default new CourseMediaProductionService();
