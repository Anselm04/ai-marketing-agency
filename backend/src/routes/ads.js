import express from 'express';
import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import { generateDirectResponsePack } from '../services/copyEngine.js';
import { generateCampaignBundle, MAJOR_SOCIALS } from '../services/marketingEngine.js';
import { renderShortVideo } from '../services/videoRenderer.js';
import { PAID_NETWORKS } from '../services/spendGuard.js';
import { openaiStatus } from '../services/openaiService.js';

const router = express.Router();

function publicAiStatus() {
  const status = openaiStatus();
  return {
    configured: status.openaiConfigured === true,
    provider: status.provider || null,
    model: status.model || null,
    status: status.openaiConfigured === true ? 'configured' : 'not_configured',
  };
}

function briefFrom(body = {}) {
  const business = String(body.business || body.description || body.brief || '').trim();
  return {
    business,
    product: String(body.product || body.productName || '').trim() || 'Product',
    audience: String(body.audience || body.targetAudience || '').trim() || 'your audience',
    description: business || String(body.description || '').trim(),
    offer: String(body.offer || '').trim(),
    mechanism: String(body.mechanism || '').trim(),
    proof: String(body.proof || '').trim(),
    url: String(body.url || '').trim(),
    tone: body.tone || 'direct-response',
  };
}

async function loadUser(req) {
  const uid = userIdOf(req);
  const user = await store.findUserById(uid);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return { uid, user };
}

function managedAdsMigration(res) {
  return res.status(410).json({
    error: 'This legacy paid-ad control has been retired. Use the managed paid advertising workflow, which verifies the real provider account, campaign configuration, account currency, provider-side spend controls and live-certification status.',
    code: 'legacy_paid_ads_retired',
    replacementPath: '/api/paid-ads',
    liveLaunchClaimed: false,
  });
}

function safeRouteFailure(res, error, fallback, code) {
  const status = Number(error?.status || error?.statusCode);
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ error: error.message || fallback, code: error.code || code });
  }
  return res.status(500).json({ error: fallback, code });
}

router.get('/', async (req, res) => {
  try {
    await loadUser(req);
    return res.json({
      campaigns: [],
      paidNetworks: PAID_NETWORKS,
      legacyPaidAdsRetired: true,
      replacementPath: '/api/paid-ads',
      message: 'Paid-ad execution moved to the managed advertising workflow. This legacy route no longer reports locally recorded launches as live campaigns.',
    });
  } catch (err) {
    return safeRouteFailure(res, err, 'Advertising workspace could not be loaded.', 'ads_workspace_failed');
  }
});

router.get('/ai-status', (_req, res) => {
  res.json(publicAiStatus());
});

// These legacy endpoints previously maintained a separate local/in-memory spend
// model and could report a successful "launch" without making an ad-network call.
// They are deliberately retired so there is one authoritative paid-ad workflow.
router.get('/budget', (_req, res) => managedAdsMigration(res));
router.patch('/budget', (_req, res) => managedAdsMigration(res));
router.get('/addon', (_req, res) => managedAdsMigration(res));
router.post('/addon', (_req, res) => managedAdsMigration(res));
router.delete('/addon', (_req, res) => managedAdsMigration(res));
router.post('/launch', (_req, res) => managedAdsMigration(res));

router.post('/generate', async (req, res) => {
  try {
    const { uid } = await loadUser(req);
    const brief = briefFrom(req.body || {});
    const pack = generateDirectResponsePack(brief);
    return res.json({
      pack,
      ownerId: uid,
      generationMode: 'deterministic_template',
      aiGenerated: false,
      published: false,
      disclaimer: 'This is a deterministic starter template generated from your brief. It is not claimed as AI-generated or published content.',
    });
  } catch (err) {
    return safeRouteFailure(res, err, 'The starter copy pack could not be generated.', 'ads_template_generation_failed');
  }
});

router.post('/generate-campaign', async (req, res) => {
  try {
    const { uid } = await loadUser(req);
    const brief = briefFrom(req.body || {});
    const bundle = await generateCampaignBundle({
      product: brief.product,
      audience: brief.audience,
      description: brief.description,
      ownerId: uid,
      tone: brief.tone,
      platforms: MAJOR_SOCIALS,
    });
    let video = null;
    try {
      const videoId = `vid_${Date.now()}`;
      const rendered = await renderShortVideo({
        product: brief.product,
        audience: brief.audience,
        description: brief.description,
        ownerId: uid,
        videoId,
      });
      video = { videoId, filename: rendered.filename, size: rendered.size, durationSec: rendered.durationSec, rendered: true };
    } catch {
      video = { rendered: false, reason: 'video_render_unavailable' };
    }
    return res.json({
      ...bundle,
      video,
      generationMode: 'deterministic_template',
      aiGenerated: false,
      published: false,
      disclaimer: 'This campaign starter bundle is deterministic template output from your brief. It is not claimed as AI-generated or live-published campaign work.',
    });
  } catch (err) {
    return safeRouteFailure(res, err, 'The campaign starter bundle could not be generated.', 'ads_template_campaign_failed');
  }
});

export { publicAiStatus };
export default router;