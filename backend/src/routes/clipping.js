import express from 'express';
import store from '../utils/store.js';
import clippingAgencyService from '../services/clippingAgencyService.js';

const router = express.Router();

function ownerId(req) {
  return req.user?.id || req.userId;
}

async function getOwnedCampaign(req, res) {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || (campaign.owner || campaign.ownerId) !== ownerId(req)) {
    res.status(404).json({ error: 'Clipping campaign not found' });
    return null;
  }
  if (campaign.kind !== 'ai-clipping') {
    res.status(404).json({ error: 'Clipping campaign not found' });
    return null;
  }
  return campaign;
}

router.get('/campaigns', async (req, res) => {
  const owner = ownerId(req);
  const campaigns = (await store.getCampaigns())
    .filter((campaign) => campaign.kind === 'ai-clipping' && (campaign.owner || campaign.ownerId) === owner)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(campaigns);
});

router.post('/campaigns', async (req, res) => {
  const {
    name,
    brief = '',
    transcript = '',
    sourceUrl = '',
    sourceDurationSeconds = null,
    targetAudience = '',
    brandVoice = '',
    platforms = [],
    budget = 0,
    agencyRate = 0.2,
    maxClips = 6,
    rightsManifest = {},
  } = req.body || {};

  if (!String(name || '').trim()) {
    return res.status(400).json({ error: 'Campaign name is required' });
  }
  if (!String(brief || transcript || sourceUrl).trim()) {
    return res.status(400).json({ error: 'Provide a campaign brief, transcript, or source URL' });
  }

  const normalizedPlatforms = [...new Set(
    (Array.isArray(platforms) ? platforms : []).map((platform) => String(platform).trim()).filter(Boolean),
  )];
  const economics = clippingAgencyService.calculateEconomics(budget, agencyRate);

  const campaign = await store.createCampaign({
    kind: 'ai-clipping',
    name: String(name).trim(),
    brief,
    transcript,
    sourceUrl,
    sourceDurationSeconds: Number(sourceDurationSeconds) || null,
    targetAudience,
    brandVoice,
    platforms: normalizedPlatforms.length ? normalizedPlatforms : ['TikTok', 'Instagram', 'YouTube'],
    budget: economics.totalBudget,
    agencyRate: economics.agencyRate,
    economics,
    maxClips: Math.max(1, Math.min(Number(maxClips) || 6, 12)),
    rightsManifest: {
      confirmedOwnership: rightsManifest.confirmedOwnership === true,
      commercialUseAllowed: rightsManifest.commercialUseAllowed === true,
      allowedPlatforms: Array.isArray(rightsManifest.allowedPlatforms)
        ? rightsManifest.allowedPlatforms
        : normalizedPlatforms,
      territories: Array.isArray(rightsManifest.territories) ? rightsManifest.territories : ['worldwide'],
      expiresAt: rightsManifest.expiresAt || null,
      notes: rightsManifest.notes || '',
    },
    autonomous: {
      enabled: false,
      intervalMinutes: 180,
      humanApprovalRequiredBeforeFirstPublish: true,
    },
    clipPlan: null,
    performance: [],
    optimization: null,
    status: 'draft',
    owner: ownerId(req),
  });

  res.status(201).json(campaign);
});

router.get('/campaigns/:id', async (req, res) => {
  const campaign = await getOwnedCampaign(req, res);
  if (campaign) res.json(campaign);
});

router.post('/campaigns/:id/plan', async (req, res) => {
  const campaign = await getOwnedCampaign(req, res);
  if (!campaign) return;

  const plan = await clippingAgencyService.generateClipPlan({
    ...campaign,
    maxClips: req.body?.maxClips || campaign.maxClips,
  });
  const scheduledClips = clippingAgencyService.scheduleClips(plan.clips, {
    startAt: req.body?.startAt,
    intervalMinutes: req.body?.intervalMinutes || campaign.autonomous?.intervalMinutes,
  });

  const updated = await store.updateCampaign(campaign.id, {
    clipPlan: { ...plan, clips: scheduledClips },
    status: 'planned',
  });
  res.json(updated);
});

router.post('/campaigns/:id/activate', async (req, res) => {
  const campaign = await getOwnedCampaign(req, res);
  if (!campaign) return;

  const rights = clippingAgencyService.validateRightsManifest(campaign.rightsManifest);
  if (!rights.valid) {
    return res.status(409).json({ error: 'Rights verification failed', details: rights.errors });
  }
  if (!campaign.clipPlan?.clips?.length) {
    return res.status(409).json({ error: 'Generate a clip plan before activating autonomous mode' });
  }

  const autonomous = {
    ...campaign.autonomous,
    enabled: true,
    intervalMinutes: Math.max(30, Number(req.body?.intervalMinutes) || campaign.autonomous?.intervalMinutes || 180),
    humanApprovalRequiredBeforeFirstPublish: req.body?.humanApprovalRequiredBeforeFirstPublish !== false,
    activatedAt: new Date().toISOString(),
  };

  const updated = await store.updateCampaign(campaign.id, {
    autonomous,
    status: 'running',
  });
  res.json(updated);
});

router.post('/campaigns/:id/pause', async (req, res) => {
  const campaign = await getOwnedCampaign(req, res);
  if (!campaign) return;

  const updated = await store.updateCampaign(campaign.id, {
    autonomous: { ...campaign.autonomous, enabled: false },
    status: 'paused',
  });
  res.json(updated);
});

router.post('/campaigns/:id/metrics', async (req, res) => {
  const campaign = await getOwnedCampaign(req, res);
  if (!campaign) return;

  const incoming = Array.isArray(req.body?.metrics) ? req.body.metrics : [];
  if (incoming.length === 0) {
    return res.status(400).json({ error: 'metrics must be a non-empty array' });
  }

  const performance = [...(campaign.performance || []), ...incoming].slice(-500);
  const optimization = await clippingAgencyService.optimize(performance, campaign);
  const updated = await store.updateCampaign(campaign.id, { performance, optimization });
  res.json(updated);
});

export default router;
