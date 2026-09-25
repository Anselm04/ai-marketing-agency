import express from 'express';
import { videoPlatformCatalog, getVideoPlatform } from '../services/videoPlatformCatalog.js';
import userVideoPublisherService from '../services/userVideoPublisherService.js';
import { getTokens } from '../services/appConnector.js';

const router = express.Router();

function userId(req) {
  return req.user?.id || req.userId;
}

router.get('/platforms', async (req, res) => {
  const platforms = await Promise.all(videoPlatformCatalog.map(async (platform) => ({
    ...platform,
    connected: platform.connectorId
      ? Boolean(await getTokens(userId(req), platform.connectorId))
      : false,
  })));

  res.json({
    platforms,
    total: platforms.length,
    connected: platforms.filter((platform) => platform.connected).length,
    directPublishingReady: platforms.filter((platform) => platform.publish === 'direct_api').length,
  });
});

router.post('/publish', async (req, res) => {
  const {
    platformId,
    mediaUrl,
    title = '',
    caption = '',
    hashtags = [],
    settings = {},
  } = req.body || {};

  if (!platformId || !getVideoPlatform(String(platformId).toLowerCase())) {
    return res.status(400).json({ error: 'A valid platformId is required' });
  }
  if (!String(mediaUrl || '').trim()) {
    return res.status(400).json({ error: 'mediaUrl is required' });
  }

  const result = await userVideoPublisherService.publish({
    userId: userId(req),
    platformId,
    mediaUrl,
    title,
    caption,
    hashtags,
    settings,
  });

  res.status(result.success ? 200 : result.blocked ? 409 : 422).json(result);
});

router.post('/publish-many', async (req, res) => {
  const {
    platformIds = [],
    mediaUrl,
    title = '',
    caption = '',
    hashtags = [],
    settings = {},
  } = req.body || {};

  if (!Array.isArray(platformIds) || platformIds.length === 0) {
    return res.status(400).json({ error: 'platformIds must be a non-empty array' });
  }
  if (!String(mediaUrl || '').trim()) {
    return res.status(400).json({ error: 'mediaUrl is required' });
  }

  const results = await userVideoPublisherService.publishMany({
    userId: userId(req),
    platformIds,
    mediaUrl,
    title,
    caption,
    hashtags,
    settings,
  });

  const succeeded = results.filter((result) => result.success).length;
  res.status(succeeded ? 200 : 409).json({
    success: succeeded > 0,
    succeeded,
    failed: results.length - succeeded,
    results,
  });
});

export default router;
