import express from 'express';
import { asyncRoute } from '../utils/asyncRoute.js';
import { authenticate } from '../middleware/auth.js';
import videoStudio from '../services/videoStudio.js';

const router = express.Router();

router.use(authenticate);

function videoInputError(message, code) {
  return Object.assign(new Error(message), { status: 400, statusCode: 400, code });
}

export function requireRealVideoAiResult(result) {
  const content = String(result?.content || '').trim();
  if (!result || result.fallback === true || !content) {
    const error = new Error('The AI provider could not generate this Video Studio result.');
    error.status = 503;
    error.statusCode = 503;
    error.code = 'ai_provider_unavailable';
    throw error;
  }
  return { ...result, fallback: false, content };
}

router.post('/script', asyncRoute(async (req, res) => {
  const { videoType, topic, duration, platform } = req.body || {};
  if (!String(topic || '').trim()) throw videoInputError('Topic is required.', 'video_topic_required');
  const safeDuration = Number(duration);
  if (!Number.isFinite(safeDuration) || safeDuration < 5 || safeDuration > 3600) {
    throw videoInputError('Duration must be between 5 and 3600 seconds.', 'video_duration_invalid');
  }
  const result = requireRealVideoAiResult(await videoStudio.generateScript(videoType || 'short-form', String(topic).trim(), safeDuration, platform || 'TikTok'));
  res.json(result);
}));

router.post('/storyboard', asyncRoute(async (req, res) => {
  const { script, style } = req.body || {};
  if (!String(script || '').trim()) throw videoInputError('Script is required.', 'video_script_required');
  const result = requireRealVideoAiResult(await videoStudio.generateStoryboard(String(script).trim(), style || 'modern'));
  res.json(result);
}));

router.post('/thumbnails', asyncRoute(async (req, res) => {
  const { topic, brandColors } = req.body || {};
  if (!String(topic || '').trim()) throw videoInputError('Topic is required.', 'video_topic_required');
  const result = requireRealVideoAiResult(await videoStudio.suggestThumbnails(String(topic).trim(), String(brandColors || '').trim()));
  res.json(result);
}));

router.post('/hashtags', asyncRoute(async (req, res) => {
  const { topic, platform } = req.body || {};
  if (!String(topic || '').trim()) throw videoInputError('Topic is required.', 'video_topic_required');
  const result = requireRealVideoAiResult(await videoStudio.suggestHashtags(String(topic).trim(), platform || 'TikTok'));
  res.json(result);
}));

router.post('/ad', asyncRoute(async (req, res) => {
  const { product, audience, duration } = req.body || {};
  if (!String(product || '').trim()) throw videoInputError('Product is required.', 'video_product_required');
  if (!String(audience || '').trim()) throw videoInputError('Audience is required.', 'video_audience_required');
  const safeDuration = duration == null ? 15 : Number(duration);
  if (!Number.isFinite(safeDuration) || safeDuration < 5 || safeDuration > 300) {
    throw videoInputError('Ad duration must be between 5 and 300 seconds.', 'video_duration_invalid');
  }
  const result = requireRealVideoAiResult(await videoStudio.generateVideoAd(String(product).trim(), String(audience).trim(), safeDuration));
  res.json(result);
}));

export default router;
