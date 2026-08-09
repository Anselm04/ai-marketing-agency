import express from 'express';
import { authenticate } from '../middleware/auth.js';
import videoStudio from '../services/videoStudio.js';

const router = express.Router();

router.use(authenticate);

router.post('/script', async (req, res) => {
  const { videoType, topic, duration, platform } = req.body;
  const result = await videoStudio.generateScript(videoType, topic, duration, platform);
  res.json(result);
});

router.post('/storyboard', async (req, res) => {
  const { script, style } = req.body;
  const result = await videoStudio.generateStoryboard(script, style);
  res.json(result);
});

router.post('/thumbnails', async (req, res) => {
  const { topic, brandColors } = req.body;
  const result = await videoStudio.suggestThumbnails(topic, brandColors);
  res.json(result);
});

router.post('/hashtags', async (req, res) => {
  const { topic, platform } = req.body;
  const result = await videoStudio.suggestHashtags(topic, platform);
  res.json(result);
});

router.post('/ad', async (req, res) => {
  const { product, audience, duration } = req.body;
  const result = await videoStudio.generateVideoAd(product, audience, duration);
  res.json(result);
});

export default router;
