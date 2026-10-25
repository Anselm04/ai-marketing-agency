import express from 'express';
import store from '../utils/store.js';

const router = express.Router();

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

router.post('/projects/:id/generate-curriculum', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;

  const rights = validateRightsManifest(project.rightsManifest);
  if (!rights.valid) {
    return res.status(409).json({
      error: 'Course processing is blocked until content rights are verified.',
      details: rights.errors,
    });
  }

  return res.status(501).json({
    error: 'Curriculum generation is not implemented yet.',
    code: 'course_factory_generation_pending',
  });
});

export { normalizeRightsManifest, validateRightsManifest };
export default router;
