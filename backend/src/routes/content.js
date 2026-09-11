import express from 'express';
import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import { generatePlatformCopy, MAJOR_SOCIALS } from '../services/marketingEngine.js';
import { ORGANIC_NETWORKS, CONTENT_TYPES, contentTypesOf, canonicalPlatform, networkOf } from '../services/spendGuard.js';
import { openaiStatus } from '../services/openaiService.js';
import socialMediaService from '../services/socialMediaService.js';

const router = express.Router();

router.get('/types', (req, res) => {
  res.json({
    included: true,
    platforms: ORGANIC_NETWORKS.map((n) => ({
      id: n.id,
      name: n.name,
      category: n.category,
      types: CONTENT_TYPES[n.id] || [],
    })),
  });
});

router.get('/', async (req, res) => {
  const content = (await store.getContentByOwner(userIdOf(req))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(content);
});

router.post('/generate', async (req, res) => {
  const uid = userIdOf(req);
  const product = String(req.body?.product || req.body?.productName || '').trim() || 'Your product';
  const audience = String(req.body?.audience || '').trim() || 'your audience';
  const description = String(req.body?.description || req.body?.brief || '').trim();
  const typeId = String(req.body?.contentType || req.body?.type || 'native_post').trim();
  const platformIds = Array.isArray(req.body?.platforms) && req.body.platforms.length
    ? req.body.platforms.map(canonicalPlatform)
    : (req.body?.platform ? [canonicalPlatform(req.body.platform)] : ORGANIC_NETWORKS.map((n) => n.id));
  const wanted = platformIds.map((id) => networkOf(id)).filter(Boolean);
  if (!wanted.length) return res.status(400).json({ error: 'Pick at least one organic network.' });
  const copy = await generatePlatformCopy({
    product, audience, description, ownerId: uid, tone: req.body?.tone || 'professional', platforms: wanted,
  });
  const items = [];
  for (const spec of wanted) {
    const c = copy[spec.id];
    if (!c) continue;
    const types = contentTypesOf(spec.id);
    const type = types.find((t) => t.id === typeId) || types[0] || { id: 'native_post', name: 'Native post' };
    const body = `${type.name ? `[${type.name}]\n` : ''}${c.body}`;
    items.push(await store.createContent({
      owner: uid,
      title: `${spec.name} · ${type.name} — ${product}`,
      type: type.id,
      body,
      platform: spec.id,
      platformName: spec.name,
      status: 'draft',
      published: false,
      campaignId: req.body?.campaignId || null,
    }));
  }
  const ai = openaiStatus();
  res.status(201).json({
    success: true,
    published: false,
    items,
    uniqueBodies: new Set(items.map((i) => i.body)).size,
    missingKey: ai.missingKey,
    openai: ai,
    disclaimer: 'Drafts in your workspace. Platform-specific, not an identical blast. Not posted until a connector token exists.',
  });
});

router.post('/:id/queue', async (req, res) => {
  const uid = userIdOf(req);
  const item = await store.getContentById(req.params.id, uid);
  if (!item) return res.status(404).json({ error: 'Content not found' });
  const updated = await store.updateContent(item.id, {
    status: 'queued',
    published: false,
    scheduledAt: req.body?.scheduledAt || new Date(Date.now() + 3600000).toISOString(),
  }, uid);
  res.json({ ...updated, published: false, message: 'Queued in your workspace. Not sent to the network.' });
});

router.post('/:id/publish', async (req, res) => {
  const uid = userIdOf(req);
  const item = await store.getContentById(req.params.id, uid);
  if (!item) return res.status(404).json({ error: 'Content not found' });
  const platform = canonicalPlatform(item.platform);
  const mine = await store.getSocialConnectionsByOwner(uid);
  const conn = mine.find((c) => canonicalPlatform(c.platform) === platform);
  const connected = !!socialMediaService.isAvailable(platform) || !!conn?.tokenSet;
  if (!connected) {
    const queued = await store.updateContent(item.id, { status: 'queued', published: false }, uid);
    return res.json({
      platform,
      published: false,
      queued: true,
      content: queued,
      message: `Queued. ${item.platformName || platform} has no token yet.`,
    });
  }
  const raw = await socialMediaService.publishToAll({
    [platform]: true,
    twitter: platform === 'x',
    caption: item.body,
    text: item.body,
    message: item.body,
  });
  const r = raw[0] || {};
  const published = !!(r.success && !r.fallback && r.postId && r.postId !== 'placeholder');
  const updated = await store.updateContent(item.id, {
    status: published ? 'published' : 'queued',
    published,
  }, uid);
  res.json({ platform, published, queued: !published, content: updated, message: published ? 'Published' : (r.message || 'Not published') });
});

router.post('/', async (req, res) => {
  const { owner, userId, user, ...rest } = req.body || {};
  const content = await store.createContent({ ...rest, owner: userIdOf(req), published: false });
  res.status(201).json(content);
});

router.get('/:id', async (req, res) => {
  const content = await store.getContentById(req.params.id, userIdOf(req));
  if (!content) return res.status(404).json({ error: 'Content not found' });
  res.json(content);
});

router.patch('/:id', async (req, res) => {
  const { owner, userId, user, ...rest } = req.body || {};
  const updated = await store.updateContent(req.params.id, rest, userIdOf(req));
  if (!updated) return res.status(404).json({ error: 'Content not found' });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const ok = await store.deleteContent(req.params.id, userIdOf(req));
  if (!ok) return res.status(404).json({ error: 'Content not found' });
  res.json({ success: true });
});

export default router;
