import express from 'express';
import store from '../utils/store.js';
import { authenticate } from '../middleware/auth.js';
import affiliateService from '../services/affiliateService.js';

const router = express.Router();
router.use(authenticate);

router.get('/code', async (req, res) => {
  const result = await affiliateService.assignCode(req.user.id);
  res.json(result);
});

router.get('/stats', async (req, res) => {
  const stats = await affiliateService.getStats(req.user.id);
  res.json(stats || { code: null, totalReferrals: 0, totalCommission: 0, referrals: [] });
});

router.post('/track', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  const result = await affiliateService.trackReferral(code, req.user.id);
  res.json(result);
});

export default router;
