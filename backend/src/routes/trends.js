import express from 'express';
import { authenticate } from '../middleware/auth.js';
import trendScanner from '../services/trendScanner.js';

const router = express.Router();

router.use(authenticate);

function requiredText(value, field, code) {
  const text = String(value || '').trim();
  if (!text) {
    const error = new Error(`${field} is required.`);
    error.status = 400;
    error.statusCode = 400;
    error.code = code;
    throw error;
  }
  return text;
}

router.get('/', async (req, res) => {
  const trends = await trendScanner.getAllTrends();
  res.json(trends);
});

router.post('/predict', async (req, res, next) => {
  try {
    const niche = requiredText(req.body?.niche, 'Niche', 'trend_niche_required');
    const result = await trendScanner.predictTrends(niche);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/viral-content', async (req, res, next) => {
  try {
    const brand = requiredText(req.body?.brand, 'Brand', 'trend_brand_required');
    const niche = requiredText(req.body?.niche, 'Niche', 'trend_niche_required');
    const result = await trendScanner.suggestViralContent(brand, niche);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { requiredText };
export default router;
