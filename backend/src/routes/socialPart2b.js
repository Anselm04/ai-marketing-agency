import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import { canonicalPlatform } from '../services/spendGuard.js';
import { reserveDailyPostQuota } from '../services/planQuotaService.js';
import { recordUsage } from '../services/usageMeteringService.js';
import { releaseQuotaReservation, settleUsageReservation } from '../services/quotaReservationService.js';
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

async function publishOneWithQuota({ userId, platform, content, metadata = {} }) {
  let reservation = null;
  try {
    reservation = (await reserveDailyPostQuota(userId, 1)).reservation;
    const raw = await publishWithPreferredToken(userId, platform, content);
    const honest = honestResult(raw[0] || { platform, fallback: true });

    if (honest.published) {
      if (reservation?.id) {
        await settleUsageReservation({
          id: reservation.id,
          userId,
          metric: 'social_posts',
          quantity: 1,
          metadata: { platform, source: 'manual_publish', ...metadata },
        });
      } else {
        await recordUsage({
          userId,
          metric: 'social_posts',
          quantity: 1,
          metadata: { platform, source: 'manual_publish', ...metadata },
        });
      }
      reservation = null;
      return honest;
    }

    if (reservation?.id) await releaseQuotaReservation(reservation.id);
    reservation = null;
    return honest;
  } finally {
    if (reservation?.id) {
      await releaseQuotaReservation(reservation.id).catch(() => {});
    }
  }
}

export function mountSocialPart2b(router) {
router.post('/queue', async (req, res) => {
  const uid = userIdOf(req);
  const post = await store.getSocialPostById(req.body?.id, uid);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.published || ['published', 'publishing'].includes(post.status)) {
    return res.status(409).json({ error: 'Published or currently publishing posts cannot be added to the manual queue.' });
  }
  if (req.body?.scheduledAt != null) {
    return res.status(503).json({
      code: 'social_scheduling_unavailable',
      automaticPublishing: false,
      error: 'Automatic scheduling is unavailable. Save to the manual queue, then choose Publish now when ready.',
    });
  }
  const updated = await store.queueSocialPost(post.id, uid);
  if (!updated) return res.status(409).json({ error: 'This post changed while saving. Refresh before trying again.' });
  res.json({ ...updated, published: false, message: 'Saved to your manual queue. Choose Publish now when ready; posts do not publish automatically.' });
});

router.post('/posts/:id/publish', async (req, res, next) => {
  const uid = userIdOf(req);
  const post = await store.getSocialPostById(req.params.id, uid);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.published || post.status === 'published') {
    return res.status(409).json({ error: 'This post is already published.', code: 'social_post_already_published' });
  }
  const platform = canonicalPlatform(post.platform);
  try {
    const honest = await publishOneWithQuota({
      userId: uid,
      platform,
      content: publishContent(platform, post, req.body || {}),
      metadata: { localPostId: post.id },
    });
    const updated = await store.updateSocialPost(post.id, {
      status: honest.published ? 'published' : 'queued',
      published: honest.published,
      externalPostId: honest.postId || null,
    }, uid);
    return res.json({ ...honest, post: updated });
  } catch (error) {
    return next(error);
  }
});

router.post('/publish', async (req, res, next) => {
  const uid = userIdOf(req);
  const caption = req.body?.caption || req.body?.text || req.body?.message || '';
  const platforms = Object.keys(req.body || {})
    .filter((key) => req.body[key] === true && !['caption', 'text', 'message', 'hashtags', 'videoUrl', 'imageUrl'].includes(key))
    .map(canonicalPlatform);

  if (platforms.length === 0) {
    return res.status(400).json({
      error: 'Choose one explicit platform. This endpoint never performs an implicit publish-to-all operation.',
      code: 'social_platform_required',
    });
  }
  if (platforms.length > 1) {
    return res.status(400).json({
      error: 'No identical spam blasts. Generate platform-specific drafts, then publish each one separately.',
      code: 'social_multi_platform_blast_blocked',
    });
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

  try {
    const honest = await publishOneWithQuota({
      userId: uid,
      platform,
      content: publishContent(platform, { ...req.body, body: caption }),
      metadata: { localPostId: post.id },
    });
    await store.updateSocialPost(post.id, {
      status: honest.published ? 'published' : 'queued',
      published: honest.published,
      externalPostId: honest.postId || null,
    }, uid);
    return res.json({
      success: honest.published,
      published: honest.published,
      results: [{ ...honest, postId: honest.postId, localPostId: post.id }],
    });
  } catch (error) {
    await store.updateSocialPost(post.id, { status: 'queued', published: false }, uid).catch(() => {});
    return next(error);
  }
});

router.post('/:platform', async (req, res, next) => {
  const platform = canonicalPlatform(req.params.platform);
  if (['generate', 'queue', 'posts', 'status', 'publish', 'connect', 'connections', 'oauth', 'networks'].includes(platform)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const uid = userIdOf(req);
  try {
    const honest = await publishOneWithQuota({
      userId: uid,
      platform,
      content: publishContent(platform, req.body || {}),
    });
    const post = await store.createSocialPost({
      owner: uid,
      platform,
      body: req.body?.caption || req.body?.text || '',
      status: honest.published ? 'published' : 'queued',
      published: honest.published,
      externalPostId: honest.postId || null,
    });
    return res.json({ ...honest, localPostId: post.id });
  } catch (error) {
    return next(error);
  }
});

}

export { publishOneWithQuota };
