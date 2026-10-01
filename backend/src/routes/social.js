import express from 'express';
import socialMediaService from '../services/socialMediaService.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  const status = await socialMediaService.getAllPlatformStatus();
  res.json(status);
});

router.post('/publish', async (req, res) => {
  try {
    const results = await socialMediaService.publishToAll(req.body);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic platform publish endpoint
router.post('/:platform', async (req, res) => {
  const { platform } = req.params;
  try {
    const result = await socialMediaService.publishToAll({ [platform]: true, ...req.body });
    res.json(result[0] || { platform, fallback: true, message: 'Platform not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy specific endpoints
router.post('/tiktok', async (req, res) => {
  const { videoUrl, caption, hashtags } = req.body;
  const result = await socialMediaService.publishTikTok(videoUrl, caption, hashtags);
  res.json(result);
});

router.post('/instagram', async (req, res) => {
  const { imageUrl, caption } = req.body;
  const result = await socialMediaService.publishInstagram(imageUrl, caption);
  res.json(result);
});

router.post('/meta', async (req, res) => {
  const { adSetId, creative, status } = req.body;
  const result = await socialMediaService.publishMetaAd(adSetId, creative, status);
  res.json(result);
});

router.get('/youtube/analytics', async (req, res) => {
  const { channelId, metrics } = req.query;
  const result = await socialMediaService.getYouTubeAnalytics(channelId, metrics ? metrics.split(',') : undefined);
  res.json(result);
});

export default router;
