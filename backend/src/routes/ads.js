import express from 'express';
import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import { generateDirectResponsePack } from '../services/copyEngine.js';
import { generateCampaignBundle, MAJOR_SOCIALS } from '../services/marketingEngine.js';
import { renderShortVideo } from '../services/videoRenderer.js';
import { remaining, assertLaunchAllowed, DEFAULT_BUDGET, PAID_NETWORKS } from '../services/spendGuard.js';
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

async function spendEntries(uid) {
  return (await store.getAdSpendEntries?.(uid)) || userSpendFallback(uid);
}

const memSpend = new Map();
function userSpendFallback(uid) {
  return memSpend.get(String(uid)) || [];
}
function pushSpendFallback(uid, entry) {
  const k = String(uid);
  const list = memSpend.get(k) || [];
  list.push(entry);
  memSpend.set(k, list);
  return list;
}

router.get('/', async (req, res) => {
  try {
    const { uid } = await loadUser(req);
    const campaigns = (await store.getAdCampaigns?.(uid)) || [];
    res.json({ campaigns, paidNetworks: PAID_NETWORKS });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed' });
  }
});

router.get('/ai-status', (_req, res) => {
  res.json(openaiStatus());
});

router.get('/budget', async (req, res) => {
  try {
    const { uid, user } = await loadUser(req);
    const entries = await spendEntries(uid);
    res.json(remaining(user, entries));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed' });
  }
});

router.patch('/budget', async (req, res) => {
  try {
    const { uid, user } = await loadUser(req);
    const dailyMax = Number(req.body?.dailyMax);
    const monthlyMax = Number(req.body?.monthlyMax);
    const next = {
      ...(user.adBudget || {}),
      ...(Number.isFinite(dailyMax) ? { dailyMax } : {}),
      ...(Number.isFinite(monthlyMax) ? { monthlyMax } : {}),
    };
    const updated = await store.updateUser?.(uid, { adBudget: next }) || { ...user, adBudget: next };
    const entries = await spendEntries(uid);
    res.json(remaining(updated, entries));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed' });
  }
});

router.get('/addon', async (req, res) => {
  try {
    const { user } = await loadUser(req);
    res.json({
      optedIn: !!user.paidAdsAddon,
      note: 'Paid Meta/Google ads are an add-on. Organic is included in your plan.',
      defaults: DEFAULT_BUDGET,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed' });
  }
});

router.post('/addon', async (req, res) => {
  try {
    if (!req.body?.confirm) {
      return res.status(400).json({ error: 'Pass confirm: true to opt in to paid ads add-on.' });
    }
    const { uid, user } = await loadUser(req);
    const updated = await store.updateUser?.(uid, { paidAdsAddon: true }) || { ...user, paidAdsAddon: true };
    const entries = await spendEntries(uid);
    res.json(remaining(updated, entries));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed' });
  }
});

router.delete('/addon', async (req, res) => {
  try {
    const { uid } = await loadUser(req);
    await store.updateUser?.(uid, { paidAdsAddon: false });
    res.json({ optedIn: false, note: 'Paid ads add-on disabled. Organic posting is unchanged.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed' });
  }
});

router.post('/launch', async (req, res) => {
  try {
    const { uid, user } = await loadUser(req);
    const amount = Number(req.body?.amount || req.body?.spend || 0);
    const platform = String(req.body?.platform || '').toLowerCase();
    if (!PAID_NETWORKS.includes(platform)) {
      return res.status(400).json({ error: 'platform must be meta or google for paid launch.' });
    }
    const entries = await spendEntries(uid);
    const gate = assertLaunchAllowed(user, entries, amount);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });
    const entry = { id: `spend_${Date.now()}`, at: new Date().toISOString(), amount: gate.amount, platform, note: req.body?.note || 'launch' };
    if (store.addAdSpendEntry) await store.addAdSpendEntry(uid, entry);
    else pushSpendFallback(uid, entry);
    res.json({ ok: true, entry, remaining: remaining(user, [...entries, entry]), disclaimer: 'Launch recorded against your cap. Live ad-network calls still need OAuth credentials.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { uid } = await loadUser(req);
    const brief = briefFrom(req.body || {});
    const pack = generateDirectResponsePack(brief);
    res.json({ pack, ownerId: uid, disclaimer: 'Template/AI pack for your brief only. Not published.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed' });
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
    res.json({ ...bundle, video, disclaimer: 'Campaign artifacts are private to your account. Nothing is published automatically.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed' });
  }
});

export default router;
