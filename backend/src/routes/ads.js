import express from 'express';
import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import { generateDirectResponsePack } from '../services/copyEngine.js';
import { generateCampaignBundle, MAJOR_SOCIALS } from '../services/marketingEngine.js';
import { renderShortVideo } from '../services/videoRenderer.js';
import { PAID_NETWORKS } from '../services/spendGuard.js';
import { openaiStatus } from '../services/openaiService.js';

const router = express.Router();

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
    return res.status(err.status || 500).json({ error: err.message || 'Failed' });
  }
});

router.get('/ai-status', (_req, res) => {
  res.json(openaiStatus());
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
    return res.json({ pack, ownerId: uid, disclaimer: 'Template/AI pack for your brief only. Not published.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Failed' });
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
      video = { videoId, filename: rendered.filename, size: rendered.size, durationSec: rendered.durationSec };
    } catch (verr) {
      video = { error: verr.message || 'video render unavailable' };
    }
    return res.json({ ...bundle, video, disclaimer: 'Campaign artifacts are private to your account. Nothing is published automatically.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Failed' });
  }
});

export default router;