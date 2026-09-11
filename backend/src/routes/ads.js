import express from 'express';
import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import { generateDirectResponsePack } from '../services/copyEngine.js';
import { generateCampaignBundle, MAJOR_SOCIALS } from '../services/marketingEngine.js';
import { renderShortVideo } from '../services/videoRenderer.js';
import { remaining, assertLaunchAllowed, budgetOf, DEFAULT_BUDGET, PAID_NETWORKS } from '../services/spendGuard.js';
import { openaiStatus } from '../services/openaiService.js';

const router = express.Router();

function briefFrom(body = {}) {
  const business = String(body.business || body.description || body.brief || '').trim();
  return {
    business,
    product: String(body.product || body.productName || '').trim() || guessProduct(business),
    audience: String(body.audience || body.targetAudience || '').trim() || guessAudience(business),
    description: business || String(body.description || '').trim(),
    offer: String(body.offer || '').trim(),
    mechanism: String(body.mechanism || '').trim(),
    proof: String(body.proof || '').trim(),
    url: String(body.url || '').trim(),
    desires: body.desires,
    fears: body.fears,
    pains: body.pains,
    beliefs: body.beliefs,
    goals: body.goals,
    buyingTriggers: body.buyingTriggers,
    tone: body.tone || 'direct-response',
  };
}

function guessProduct(text) {
  const line = String(text || '').split(/[.\n]/)[0].trim();
  return line.slice(0, 80) || 'Your offer';
}

function guessAudience(text) {
  const m = String(text || '').match(/for ([^.]+)/i);
  return m ? m[1].trim().slice(0, 80) : 'your dream buyer';
}

router.get('/', async (req, res) => {
  const uid = userIdOf(req);
  const packs = (await store.getAdPacksByOwner(uid)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(packs.map(publicPack));
});

router.get('/avatars', async (req, res) => {
  const uid = userIdOf(req);
  const list = (await store.getAvatarsByOwner(uid)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});


async function budgetPayload(uid) {
  const user = await store.findUserById(uid);
  const entries = await store.getAdSpendByOwner(uid);
  return remaining(user, entries);
}

router.get('/ai-status', (req, res) => {
  res.json(openaiStatus());
});

router.get('/budget', async (req, res) => {
  res.json(await budgetPayload(userIdOf(req)));
});

router.patch('/budget', async (req, res) => {
  const uid = userIdOf(req);
  const user = await store.findUserById(uid);
  const current = budgetOf(user);
  const dailyMax = req.body?.dailyMax != null ? Number(req.body.dailyMax) : current.dailyMax;
  const monthlyMax = req.body?.monthlyMax != null ? Number(req.body.monthlyMax) : current.monthlyMax;
  if (!Number.isFinite(dailyMax) || dailyMax < 0 || !Number.isFinite(monthlyMax) || monthlyMax < 0) {
    return res.status(400).json({ error: 'dailyMax and monthlyMax must be >= 0' });
  }
  if (monthlyMax < dailyMax) {
    return res.status(400).json({ error: 'Monthly cap cannot be lower than daily cap.' });
  }
  await store.updateUser(uid, { adBudget: { dailyMax, monthlyMax, currency: 'USD' } });
  res.json(await budgetPayload(uid));
});

router.get('/addon', async (req, res) => {
  const uid = userIdOf(req);
  const user = await store.findUserById(uid);
  res.json({
    id: 'paid_ads',
    name: 'Paid ads add-on (Meta + Google)',
    amount: 49,
    currency: 'usd',
    interval: 'month',
    networks: PAID_NETWORKS,
    optedIn: !!user?.paidAdsAddon,
    organicIncluded: true,
    note: 'Organic posting is included in your plan. Paid Meta and Google ads are an add-on. Media spend is pass-through and never exceeds your slider.',
  });
});

router.post('/addon', async (req, res) => {
  const uid = userIdOf(req);
  if (!req.body?.confirm) {
    return res.status(400).json({ error: 'Set confirm: true to opt in to the paid ads add-on. Media spend is extra and capped by your slider.' });
  }
  await store.updateUser(uid, { paidAdsAddon: true, paidAdsAddonAt: new Date().toISOString() });
  res.json({ optedIn: true, ...(await budgetPayload(uid)) });
});

router.delete('/addon', async (req, res) => {
  const uid = userIdOf(req);
  await store.updateUser(uid, { paidAdsAddon: false });
  res.json({ optedIn: false, ...(await budgetPayload(uid)) });
});

router.post('/launch', async (req, res) => {
  const uid = userIdOf(req);
  const user = await store.findUserById(uid);
  const entries = await store.getAdSpendByOwner(uid);
  const network = String(req.body?.network || 'meta').toLowerCase();
  if (!PAID_NETWORKS.includes(network)) {
    return res.status(400).json({ error: 'Paid ads networks: meta or google. Use /api/social for organic.' });
  }
  const check = assertLaunchAllowed(user, entries, req.body?.amount);
  if (!check.ok) return res.status(check.status).json({ error: check.error, budget: remaining(user, entries) });
  const row = await store.createAdSpend({
    owner: uid,
    amount: check.amount,
    network,
    campaignId: req.body?.campaignId || null,
    note: req.body?.note || 'manual launch',
    kind: 'paid_ads',
  });
  res.status(201).json({
    success: true,
    published: false,
    spend: row,
    budget: remaining(await store.findUserById(uid), await store.getAdSpendByOwner(uid)),
    message: 'Spend reserved against your cap. Not sent to Ads Manager until a connector token exists.',
  });
});

router.get('/:id', async (req, res) => {
  const uid = userIdOf(req);
  const pack = await store.getAdPackById(req.params.id, uid);
  if (!pack) return res.status(404).json({ error: 'Ad pack not found' });
  res.json(pack);
});

router.delete('/:id', async (req, res) => {
  const uid = userIdOf(req);
  const ok = await store.deleteAdPack(req.params.id, uid);
  if (!ok) return res.status(404).json({ error: 'Ad pack not found' });
  res.json({ success: true });
});

/**
 * Dead-simple generate: paste business info → avatar + hundreds of Meta ads + headlines + social + optional video.
 * Available to every signed-in user. Never claims ads are live or promises ROAS.
 */
router.post('/generate', async (req, res) => {
  const uid = userIdOf(req);
  const brief = briefFrom(req.body);
  if (!brief.description && !brief.product) {
    return res.status(400).json({ error: 'Paste a few sentences about the business, product, and who it is for.' });
  }

  const pack = generateDirectResponsePack(brief, uid);
  const avatar = await store.createAvatar({ ...pack.avatar, owner: uid });

  const posts = [];
  for (const p of pack.socialPosts) {
    posts.push(await store.createSocialPost({
      ...p,
      owner: uid,
      status: 'draft',
      published: false,
      campaignHint: avatar.id,
    }));
  }

  let video = null;
  if (req.body.video !== false) {
    try {
      const row = await store.createVideo({
        owner: uid,
        product: pack.avatar.product,
        audience: pack.avatar.audience,
        status: 'rendering',
        published: false,
      });
      const rendered = await renderShortVideo({
        product: pack.avatar.product,
        audience: pack.avatar.audience,
        description: pack.avatar.description,
        ownerId: uid,
        videoId: row.id,
      });
      video = await store.updateVideo(row.id, {
        status: 'ready',
        filename: rendered.filename,
        size: rendered.size,
        mime: rendered.mime,
        durationSec: rendered.durationSec,
        script: rendered.script,
        downloadPath: `/api/video/${row.id}/file`,
      }, uid);
    } catch (err) {
      video = { status: 'error', error: err.message, published: false };
    }
  }

  const saved = await store.createAdPack({
    owner: uid,
    avatarId: avatar.id,
    product: pack.avatar.product,
    audience: pack.avatar.audience,
    counts: pack.counts,
    ads: pack.ads,
    headlines: pack.headlines,
    primaryTexts: pack.primaryTexts,
    linkDescriptions: pack.linkDescriptions,
    landingSets: pack.landingSets,
    seo: pack.seo,
    socialPostIds: posts.map((p) => p.id),
    videoId: video?.id || null,
    disclaimer: pack.disclaimer,
    language: 'en',
    published: false,
  });

  const campaign = await store.createCampaign({
    owner: uid,
    name: `${pack.avatar.product} — ad pack`,
    status: 'draft',
    productName: pack.avatar.product,
    targetAudience: pack.avatar.audience,
    description: pack.avatar.description,
    adPackId: saved.id,
    avatarId: avatar.id,
    published: false,
  });

  const ai = openaiStatus();
  res.status(201).json({
    success: true,
    published: false,
    missingKey: ai.missingKey,
    openai: ai,
    disclaimer: pack.disclaimer,
    avatar,
    campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
    pack: publicPack(saved),
    ads: pack.ads,
    headlines: pack.headlines,
    primaryTexts: pack.primaryTexts,
    linkDescriptions: pack.linkDescriptions,
    landingSets: pack.landingSets,
    socialPosts: posts,
    seo: pack.seo,
    video: video && video.id ? { id: video.id, status: video.status, downloadPath: video.downloadPath, size: video.size } : video,
    counts: pack.counts,
  });
});

router.post('/generate-campaign', async (req, res) => {
  const uid = userIdOf(req);
  const brief = briefFrom(req.body);
  if (!brief.description && !brief.product) {
    return res.status(400).json({ error: 'Paste business info first.' });
  }
  const bundle = await generateCampaignBundle({
    product: brief.product,
    audience: brief.audience,
    description: brief.description,
    ownerId: uid,
    tone: brief.tone,
    platforms: MAJOR_SOCIALS,
  });
  const campaign = await store.createCampaign({
    owner: uid,
    name: bundle.plan.campaignName || `${brief.product} campaign`,
    status: 'draft',
    productName: brief.product,
    targetAudience: brief.audience,
    description: brief.description,
    strategy: bundle.plan,
    schedule: bundle.schedule,
    platforms: bundle.platforms,
    published: false,
  });
  const posts = [];
  for (const [platform, copy] of Object.entries(bundle.copy)) {
    posts.push(await store.createSocialPost({
      owner: uid,
      platform,
      platformName: copy.platformName,
      body: copy.body,
      hashtags: copy.hashtags,
      status: 'queued',
      published: false,
      scheduledAt: bundle.schedule.find((s) => s.platform === platform)?.scheduledAt || null,
      campaignId: campaign.id,
    }));
    await store.createContent({
      owner: uid,
      title: `${copy.platformName} — ${brief.product}`,
      type: 'social_post',
      body: copy.body,
      platform,
      campaignId: campaign.id,
    });
  }
  res.status(201).json({
    success: true,
    published: false,
    campaign,
    posts,
    seo: bundle.seo,
    schedule: bundle.schedule,
    disclaimer: 'Queued in your workspace only. Not published anywhere until a connector token exists.',
  });
});

function publicPack(pack) {
  if (!pack) return null;
  return {
    id: pack.id,
    product: pack.product,
    audience: pack.audience,
    counts: pack.counts,
    avatarId: pack.avatarId,
    videoId: pack.videoId,
    disclaimer: pack.disclaimer,
    language: pack.language,
    createdAt: pack.createdAt,
    published: false,
  };
}

export default router;
