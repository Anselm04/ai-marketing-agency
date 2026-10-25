import express from 'express';
import store from '../utils/store.js';
import courseFactoryService, {
  buildCourseProjectKey,
  validateMultipartParts,
} from '../services/courseFactoryService.js';
import mediaClipperService from '../services/mediaClipperService.js';
import courseVisualAnalysisService from '../services/courseVisualAnalysisService.js';
import { courseRightsError } from '../services/courseRightsService.js';
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  getMultipartPartUploadUrl,
  getPrivateSignedDownloadUrl,
  isS3Configured,
} from '../services/uploadService.js';

const router = express.Router();
const DEFAULT_PART_SIZE = Number(process.env.COURSE_FACTORY_MULTIPART_PART_BYTES) || 64 * 1024 * 1024;
const MAX_SOURCE_BYTES = Number(process.env.COURSE_FACTORY_MAX_SOURCE_BYTES) || 500 * 1024 * 1024 * 1024;
const SOURCE_SIGNED_URL_SECONDS = Number(process.env.COURSE_FACTORY_SOURCE_SIGNED_URL_SECONDS) || 21600;

function ownerId(req) {
  return req.user?.id || req.userId;
}

function normalizeRightsManifest(input = {}) {
  return {
    confirmedOwnership: input.confirmedOwnership === true,
    commercialUseAllowed: input.commercialUseAllowed === true,
    allowedPlatforms: Array.isArray(input.allowedPlatforms) && input.allowedPlatforms.length
      ? input.allowedPlatforms.map((value) => String(value).trim()).filter(Boolean)
      : ['YouTube', 'Skool'],
    territories: Array.isArray(input.territories) && input.territories.length
      ? input.territories.map((value) => String(value).trim()).filter(Boolean)
      : ['worldwide'],
    expiresAt: input.expiresAt || null,
    notes: String(input.notes || '').slice(0, 2000),
  };
}

function validateRightsManifest(manifest = {}) {
  const errors = [];
  if (manifest.confirmedOwnership !== true) errors.push('Content ownership must be confirmed.');
  if (manifest.commercialUseAllowed !== true) errors.push('Commercial-use rights must be confirmed.');
  if (manifest.expiresAt && Number.isNaN(new Date(manifest.expiresAt).getTime())) errors.push('Rights expiry date is invalid.');
  if (manifest.expiresAt && new Date(manifest.expiresAt) <= new Date()) errors.push('Content rights have expired.');
  return { valid: errors.length === 0, errors };
}

function assertRights(project, res) {
  const rights = validateRightsManifest(project.rightsManifest);
  if (!rights.valid) {
    res.status(409).json({
      error: 'Course processing is blocked until content rights are verified.',
      details: rights.errors,
    });
    return false;
  }
  return true;
}

async function resolveSourceUrl(project) {
  if (project.sourceUrl) return project.sourceUrl;
  if (project.upload?.status === 'complete' && project.upload?.key && project.upload?.privateBucket === true) {
    return getPrivateSignedDownloadUrl(project.upload.key, SOURCE_SIGNED_URL_SECONDS);
  }
  return null;
}

async function getOwnedProject(req, res) {
  const project = await store.getCampaignById(req.params.id);
  if (!project || project.kind !== 'ai-course-factory' || (project.owner || project.ownerId) !== ownerId(req)) {
    res.status(404).json({ error: 'Course Factory project not found' });
    return null;
  }
  return project;
}

router.get('/projects', async (req, res) => {
  const projects = (await store.getCampaignsByOwner(ownerId(req)))
    .filter((campaign) => campaign.kind === 'ai-course-factory')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(projects);
});

router.post('/projects', async (req, res) => {
  const {
    name,
    targetAudience = '',
    desiredOutcome = '',
    skillLevel = 'all-levels',
    sourceUrl = '',
    sourceDurationSeconds = null,
    rightsManifest = {},
  } = req.body || {};

  if (!String(name || '').trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const project = await store.createCampaign({
    kind: 'ai-course-factory',
    name: String(name).trim().slice(0, 160),
    targetAudience: String(targetAudience || '').slice(0, 1000),
    desiredOutcome: String(desiredOutcome || '').slice(0, 1500),
    skillLevel: String(skillLevel || 'all-levels').slice(0, 80),
    sourceUrl: String(sourceUrl || '').slice(0, 4000),
    sourceDurationSeconds: Number(sourceDurationSeconds) || null,
    rightsManifest: normalizeRightsManifest(rightsManifest),
    approval: {
      humanApprovalRequired: true,
      status: 'pending',
      approvedAt: null,
      approvedBy: null,
      notes: '',
    },
    upload: null,
    transcript: '',
    transcription: null,
    visualAnalysis: null,
    curriculum: null,
    coursePackage: null,
    exportManifest: null,
    status: 'draft',
    owner: ownerId(req),
  });

  return res.status(201).json(project);
});

router.get('/projects/:id', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (project) res.json(project);
});

router.post('/projects/:id/uploads/multipart', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;
  if (!isS3Configured()) return res.status(503).json({ error: 'Durable S3-compatible storage is required for long-form Course Factory uploads.' });

  const filename = String(req.body?.filename || '').trim();
  const contentType = String(req.body?.contentType || 'video/mp4').trim();
  const size = Number(req.body?.size) || 0;
  if (!filename) return res.status(400).json({ error: 'filename is required' });
  if (size <= 0 || size > MAX_SOURCE_BYTES) return res.status(400).json({ error: `Video size must be between 1 byte and ${MAX_SOURCE_BYTES} bytes.` });
  if (!contentType.startsWith('video/')) return res.status(400).json({ error: 'Course Factory source upload must be a video file.' });

  try {
    const key = buildCourseProjectKey(ownerId(req), project.id, filename);
    const session = await createMultipartUpload(key, contentType, { privateBucket: true });
    const upload = {
      ...session,
      filename,
      contentType,
      size,
      partSize: DEFAULT_PART_SIZE,
      status: 'uploading',
      startedAt: new Date().toISOString(),
    };
    const updated = await store.updateCampaign(project.id, { upload, status: 'uploading' });
    return res.status(201).json({
      project: updated,
      upload: {
        uploadId: session.uploadId,
        key,
        privateBucket: true,
        partSize: DEFAULT_PART_SIZE,
        maxParts: 10000,
      },
    });
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

router.post('/projects/:id/uploads/multipart/part', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;
  if (!project.upload?.uploadId || !project.upload?.key || project.upload.status !== 'uploading') {
    return res.status(409).json({ error: 'No active multipart upload exists for this project.' });
  }
  try {
    const partNumber = Number(req.body?.partNumber);
    const url = await getMultipartPartUploadUrl({
      key: project.upload.key,
      uploadId: project.upload.uploadId,
      partNumber,
      expiresIn: 3600,
      privateBucket: project.upload.privateBucket === true,
    });
    return res.json({ partNumber, url });
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

router.post('/projects/:id/uploads/multipart/complete', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;
  if (!project.upload?.uploadId || !project.upload?.key) return res.status(409).json({ error: 'No multipart upload exists for this project.' });
  try {
    const parts = validateMultipartParts(req.body?.parts);
    const completed = await completeMultipartUpload({
      key: project.upload.key,
      uploadId: project.upload.uploadId,
      parts,
      privateBucket: project.upload.privateBucket === true,
    });
    const upload = {
      ...project.upload,
      status: 'complete',
      completedAt: new Date().toISOString(),
      etag: completed.etag,
      url: completed.url,
      privateBucket: completed.privateBucket === true,
    };
    const updated = await store.updateCampaign(project.id, {
      upload,
      sourceUrl: completed.privateBucket ? project.sourceUrl || '' : completed.url || project.sourceUrl || '',
      status: 'uploaded',
    });
    return res.json(updated);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

router.post('/projects/:id/uploads/multipart/abort', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;
  if (!project.upload?.uploadId || !project.upload?.key) return res.status(409).json({ error: 'No multipart upload exists for this project.' });
  try {
    await abortMultipartUpload({
      key: project.upload.key,
      uploadId: project.upload.uploadId,
      privateBucket: project.upload.privateBucket === true,
    });
    const updated = await store.updateCampaign(project.id, {
      upload: { ...project.upload, status: 'aborted', abortedAt: new Date().toISOString() },
      status: 'draft',
    });
    return res.json(updated);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

router.post('/projects/:id/transcribe', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;
  if (!assertRights(project, res)) return;

  try {
    const sourceUrl = await resolveSourceUrl(project);
    if (!sourceUrl) return res.status(400).json({ error: 'Upload or provide a source video before transcription.' });
    const transcription = await mediaClipperService.transcribeSource(sourceUrl);
    const updated = await store.updateCampaign(project.id, {
      transcript: transcription.transcript,
      sourceDurationSeconds: transcription.durationSeconds,
      transcription: {
        completedAt: new Date().toISOString(),
        chunks: transcription.chunks,
        model: transcription.model,
        provenance: { kind: 'creator_evidence' },
      },
      status: 'transcribed',
    });
    return res.json(updated);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

router.post('/projects/:id/analyse-visuals', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;
  if (!assertRights(project, res)) return;

  try {
    const sourceUrl = await resolveSourceUrl(project);
    if (!sourceUrl) return res.status(400).json({ error: 'Upload or provide a source video before visual analysis.' });
    const visualAnalysis = await courseVisualAnalysisService.analyse({
      sourceUrl,
      durationSeconds: project.sourceDurationSeconds,
      name: project.name,
      targetAudience: project.targetAudience,
      desiredOutcome: project.desiredOutcome,
    });
    const updated = await store.updateCampaign(project.id, {
      visualAnalysis,
      sourceDurationSeconds: project.sourceDurationSeconds || visualAnalysis.durationSeconds,
      approval: { ...project.approval, status: 'pending', approvedAt: null, approvedBy: null },
      status: project.transcript ? 'analysed' : 'visuals_ready',
    });
    return res.json(updated);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

router.post('/projects/:id/generate-curriculum', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;
  if (!assertRights(project, res)) return;

  try {
    const curriculum = await courseFactoryService.generateCurriculum(project);
    const updated = await store.updateCampaign(project.id, {
      curriculum,
      approval: { ...project.approval, status: 'pending', approvedAt: null, approvedBy: null },
      status: 'curriculum_ready',
    });
    return res.json(updated);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

router.post('/projects/:id/generate-package', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;
  if (!assertRights(project, res)) return;

  try {
    const coursePackage = await courseFactoryService.generatePackage(project);
    const exportManifest = {
      generatedAt: new Date().toISOString(),
      formats: ['skool-ready-json', 'youtube-metadata', 'course-manual-content', 'worksheets', 'quiz-bank', 'marketing-kit', 'short-form-plan'],
      directSkoolPublishing: false,
      note: 'Skool-ready packaging is generated for review/import. Direct publishing is not claimed without a supported integration.',
    };
    const updated = await store.updateCampaign(project.id, {
      coursePackage,
      exportManifest,
      approval: { ...project.approval, status: 'pending', approvedAt: null, approvedBy: null },
      status: 'package_ready',
    });
    return res.json(updated);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

router.post('/projects/:id/approve', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;

  const rightsError = courseRightsError(project.rightsManifest);
  if (rightsError) return res.status(409).json(rightsError);

  if (!project.coursePackage && !project.curriculum) return res.status(409).json({ error: 'Generate a curriculum or course package before approval.' });

  const approval = {
    humanApprovalRequired: true,
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy: ownerId(req),
    notes: String(req.body?.notes || '').slice(0, 4000),
  };
  const updated = await store.updateCampaign(project.id, { approval, status: 'approved' });
  return res.json(updated);
});

export { normalizeRightsManifest, validateRightsManifest, resolveSourceUrl };
export default router;
