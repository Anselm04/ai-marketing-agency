import express from 'express';
import store from '../utils/store.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAdmin);

router.get('/users', async (req, res) => {
  const users = (await store.getUsers()).map(u => { const { password: _, resetToken: __, resetTokenExpires: ___, ...safe } = u; return safe; }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
  res.json(users);
});

router.get('/overview', async (req, res) => {
  res.json({
    users: (await store.getUsers()).length,
    campaigns: (await store.getCampaigns()).length,
    agents: (await store.getAgents()).length,
    tasks: (await store.getTasks()).length,
    leads: (await store.getLeads()).length,
    subscriptions: (await store.getSubscriptions()).length,
  });
});

export default router;
