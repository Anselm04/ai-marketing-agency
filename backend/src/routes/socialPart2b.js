import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import socialMediaService from '../services/socialMediaService.js';
import { canonicalPlatform } from '../services/spendGuard.js';
import {
  publishWithPreferredToken,
  honestResult,
} from './socialHelpers.js';

function publishContent(platform, source, extra = {}) {
  const caption = source?.caption || source?.text || source?.message || source?.body || '';
  return {
    [platform]: true,
    twitter: platform === 'x',
    caption,
    text: caption,
    message: caption,
    hashtags: source?.hashtags || extra.hashtags || [],
    imageUrl: extra.imageUrl || source?.imageUrl,
    videoUrl: extra.videoUrl || source?.videoUrl,
    link: extra.link || source?.link,
    title: extra.title || source?.title,
  };
}

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
  const raw = await publishWithPreferredToken(uid, platform, publishContent(platform, post, req.body || {}));
  const honest = honestResult(raw[0] || { platform, fallback: true });
  const updated = await store.updateSocialPost(post.id, {
    status: honest.published ? 'published' : 'queued',
    published: honest.published,
    externalPostId: honest.postId || null,
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
  const post = await store.createSocialPost({
    owner: uid,
    platform,
    body: caption,
    hashtags: req.body.hashtags || [],
    imageUrl: req.body.imageUrl || null,
    videoUrl: req.body.videoUrl || null,
    status: 'publishing',
    published: false,
  });
  const raw = await publishWithPreferredToken(uid, platform, publishContent(platform, { ...req.body, body: caption }));
  const honest = honestResult(raw[0] || { platform, fallback: true });
  await store.updateSocialPost(post.id, { status: honest.published ? 'published' : 'queued', published: honest.published, externalPostId: honest.postId || null }, uid);
  results.push({ ...honest, postId: honest.postId, localPostId: post.id });
  res.json({ success: honest.published, published: honest.published, results });
});

router.post('/:platform', async (req, res) => {
  const platform = canonicalPlatform(req.params.platform);
  if (['generate', 'queue', 'posts', 'status', 'publish', 'connect', 'connections', 'oauth', 'networks'].includes(platform)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const uid = userIdOf(req);
  const raw = await publishWithPreferredToken(uid, platform, publishContent(platform, req.body || {}));
  const honest = honestResult(raw[0] || { platform, fallback: true });
  const post = await store.createSocialPost({
    owner: uid,
    platform,
    body: req.body?.caption || req.body?.text || '',
    status: honest.published ? 'published' : 'queued',
    published: honest.published,
    externalPostId: honest.postId || null,
  });
  res.json({ ...honest, localPostId: post.id });
});

}
