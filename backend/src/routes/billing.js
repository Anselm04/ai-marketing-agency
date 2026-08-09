import express from 'express';
import store from '../utils/store.js';

const router = express.Router();

router.get('/plans', (req, res) => {
  res.json([
    { id: 'starter', name: 'Starter', price: 29, interval: 'monthly', features: { agents: 3, campaigns: 2, postsPerDay: 10, teamSeats: 1 } },
    { id: 'growth', name: 'Growth', price: 79, interval: 'monthly', features: { agents: 8, campaigns: 10, postsPerDay: 50, teamSeats: 3 } },
    { id: 'pro', name: 'Pro', price: 199, interval: 'monthly', features: { agents: 14, campaigns: 25, postsPerDay: 100, teamSeats: 10 } },
  ]);
});

router.get('/subscription', async (req, res) => {
  const sub = (await store.getSubscriptions()).find(s => s.user === req.user.id);
  res.json(sub || { status: 'none' });
});

export default router;
