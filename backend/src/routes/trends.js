import express from 'express';
import { authenticate } from '../middleware/auth.js';
import trendScanner from '../services/trendScanner.js';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  const trends = await trendScanner.getAllTrends();
  res.json(trends);
});

router.post('/predict', async (req, res) => {
  const { niche } = req.body;
  const result = await trendScanner.predictTrends(niche || 'general marketing');
  res.json(result);
});

router.post('/viral-content', async (req, res) => {
  const { brand, niche } = req.body;
  const result = await trendScanner.suggestViralContent(brand || 'AI Marketing Agency', niche || 'SaaS');
  res.json(result);
});

export default router;
