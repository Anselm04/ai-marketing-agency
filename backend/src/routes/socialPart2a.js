import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import { generatePlatformCopy, MAJOR_SOCIALS, buildSchedule } from '../services/marketingEngine.js';
import { ORGANIC_PLATFORMS, ORGANIC_NETWORKS, canonicalPlatform, networkOf } from '../services/spendGuard.js';
import { encryptUtf8 } from '../utils/owner.js';
import {
  publicConnection,
} from './socialHelpers.js';

export function mountSocialPart2a(router) {
router.get('/connections', async (req, res) => {
  const list = await store.getSocialConnectionsByOwner(userIdOf(req));
  res.json({
    included: true,
    platforms: ORGANIC_PLATFORMS,
    networks: ORGANIC_NETWORKS.map((n) => ({ id: n.id, name: n.name, category: n.category })),
    connections: list.map(publicConnection),
  });
});

router.post('/connect', async (req, res) => {
  const uid = userIdOf(req);
  const platform = canonicalPlatform(req.body?.platform);
  if (!platform) return res.status(400).json({ error: 'platform required' });
  const rawToken = req.body?.token || req.body?.accessToken;
  const hasToken = !!rawToken;
  const extra = {
    status: hasToken ? 'ready' : 'needs_token',
    tokenSet: hasToken,
    label: req.body?.label || networkOf(platform)?.name || platform,
    note: hasToken
      ? 'Token stored as present (value not returned).'
      : 'Bring your own token later. You can still generate, copy, and queue native posts.',
  };
  if (hasToken) {
    try { extra.tokenCipher = encryptUtf8(String(rawToken), 'social-token'); }
    catch { extra.tokenSet = true; extra.note = 'Token marked present. Value not returned.'; }
  }
  const row = await store.upsertSocialConnection(uid, platform, extra);
  res.status(201).json({ ...publicConnection(row), charge: 'included', published: false });
});

router.delete('/connect/:platform', async (req, res) => {
  const uid = userIdOf(req);
  const plat = canonicalPlatform(req.params.platform);
  const list = await store.getSocialConnectionsByOwner(uid);
  const row = list.find((c) => canonicalPlatform(c.platform) === plat);
  if (!row) return res.status(404).json({ error: 'Not connected' });
  await store.deleteSocialConnection(row.id, uid);
  res.json({ success: true });
});

router.get('/posts', async (req, res) => {
  const posts = (await store.getSocialPostsByOwner(userIdOf(req)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts);
});

router.post('/generate', async (req, res) => {
  const uid = userIdOf(req);
  const product = String(req.body?.product || req.body?.productName || '').trim();
  const audience = String(req.body?.audience || req.body?.targetAudience || '').trim();
  const description = String(req.body?.description || req.body?.business || req.body?.brief || '').trim();
  if (!product && !description) {
    return res.status(400).json({ error: 'Describe the product and audience first.' });
  }
  const wanted = Array.isArray(req.body?.platforms) && req.body.platforms.length
    ? req.body.platforms.map(canonicalPlatform).map((id) => networkOf(id) || MAJOR_SOCIALS.find((p) => p.id === id)).filter(Boolean)
    : MAJOR_SOCIALS;
  const contentType = String(req.body?.contentType || req.body?.type || '').trim();
  const copy = await generatePlatformCopy({
    product: product || 'Your product',
    audience: audience || 'your audience',
    description,
    ownerId: uid,
    tone: req.body?.tone || 'professional',
    platforms: wanted,
  });
  const schedule = buildSchedule(wanted);
  const posts = [];
  const bodies = [];
  for (const spec of wanted) {
    const c = copy[spec.id];
    if (!c) continue;
    bodies.push(c.body);
    posts.push(await store.createSocialPost({
      owner: uid,
      platform: spec.id,
      platformName: spec.name,
      body: c.body,
      hashtags: c.hashtags,
      contentType: contentType || 'native_post',
      status: 'draft',
      published: false,
      scheduledAt: schedule.find((s) => s.platform === spec.id)?.scheduledAt || null,
    }));
  }
  const uniqueBodies = new Set(bodies).size;
  res.status(201).json({
    success: true,
    published: false,
    posts,
    uniqueBodies,
    platforms: wanted.length,
    disclaimer: 'Drafts in your workspace. Platform-specific — not an identical blast. Not posted until a connector token exists.',
  });
});

}
