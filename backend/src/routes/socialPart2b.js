import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import socialMediaService from '../services/socialMediaService.js';
import { canonicalPlatform } from '../services/spendGuard.js';
import {
  publicConnection,
  connectorConnected,
  publishWithPreferredToken,
  honestResult,
} from './socialHelpers.js';

export function mountSocialPart2b(router) {
router.post('/queue', async (req, res) => {
  const uid = userIdOf(req);
  const post = await store.getSocialPostById(req.body?.id, uid);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const updated = await store.updateSocialPost(post.id, {
    status: 'queued',
    published: false,
    scheduledAt: req.body?.scheduledAt || post.scheduledAt || new Date(Date.now() + 3600000).toISOString(),
  }, uid);
  res.json({ ...updated, published: false, message: 'Queued in your workspace. Not sent to the network.' });
});

router.post('/posts/:id/publish', async (req, res) => {
  const uid = userIdOf(req);
  const post = await store.getSocialPostById(req.params.id, uid);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const platform = canonicalPlatform(post.platform);
  const mine = await store.getSocialConnectionsByOwner(uid);
  const conn = mine.find((c) => canonicalPlatform(c.platform) === platform);
  const connected = connectorConnected(platform) || !!conn?.tokenSet;
  if (!connected) {
    const queued = await store.updateSocialPost(post.id, { status: 'queued', published: false }, uid);
    return res.json({
      ...honestResult({ platform, fallback: true, message: `Queued. ${post.platformName || platform} has no token yet. Copy the native post or connect later.` }),
      post: queued,
    });
  }
  const raw = await publishWithPreferredToken(uid, platform, {
    [platform]: true,
    twitter: platform === 'x',
    caption: post.body,
    text: post.body,
    message: post.body,
    hashtags: post.hashtags || [],
  });
  const honest = honestResult(raw[0] || { platform, fallback: true });
  const updated = await store.updateSocialPost(post.id, {
    status: honest.published ? 'published' : 'queued',
    published: honest.published,
  }, uid);
  res.json({ ...honest, post: updated });
});

router.post('/publish', async (req, res) => {
  const uid = userIdOf(req);
  const caption = req.body?.caption || req.body?.text || req.body?.message || '';
  const platforms = Object.keys(req.body || {}).filter((k) => req.body[k] === true && !['caption', 'text', 'message', 'hashtags', 'videoUrl', 'imageUrl'].includes(k)).map(canonicalPlatform);
  if (platforms.length > 1 && caption) {
    return res.status(400).json({
      error: 'No identical spam blasts. Generate platform-specific posts, then publish each one. POST /api/social/generate then POST /api/social/posts/:id/publish.',
    });
  }
  const results = [];
  if (platforms.length === 0) {
    const raw = await socialMediaService.publishToAll(req.body || {});
    return res.json({ success: true, published: false, results: (raw || []).map(honestResult) });
  }
  const platform = platforms[0];
  const mine = await store.getSocialConnectionsByOwner(uid);
  const conn = mine.find((c) => canonicalPlatform(c.platform) === platform);
  const connected = connectorConnected(platform) || !!conn?.tokenSet;
  const post = await store.createSocialPost({
    owner: uid,
    platform,
    body: caption,
    hashtags: req.body.hashtags || [],
    status: connected ? 'publishing' : 'queued',
    published: false,
  });
  if (!connected) {
    results.push({
      platform,
      postId: post.id,
      published: false,
      queued: true,
      message: `Queued. ${platform} is not connected. Copy the text into the app or connect a token later.`,
    });
    return res.json({ success: true, published: false, results });
  }
  const raw = await publishWithPreferredToken(uid, platform, { [platform]: true, twitter: platform === 'x', caption, text: caption, message: caption, ...req.body });
  const honest = honestResult(raw[0] || { platform, fallback: true });
  await store.updateSocialPost(post.id, { status: honest.published ? 'published' : 'queued', published: honest.published }, uid);
  results.push({ ...honest, postId: post.id });
  res.json({ success: true, published: results.some((r) => r.published), results });
});

router.post('/:platform', async (req, res) => {
  const platform = canonicalPlatform(req.params.platform);
  if (['generate', 'queue', 'posts', 'status', 'publish', 'connect', 'connections', 'oauth', 'networks'].includes(platform)) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (!connectorConnected(platform)) {
    const post = await store.createSocialPost({
      owner: userIdOf(req),
      platform,
      body: req.body?.caption || req.body?.text || '',
      status: 'queued',
      published: false,
    });
    return res.json({ platform, published: false, queued: true, postId: post.id, message: 'Not published — connector not connected.' });
  }
  const raw = await socialMediaService.publishToAll({ [platform]: true, twitter: platform === 'x', ...req.body });
  res.json(honestResult(raw[0] || { platform, fallback: true }));
});

}
