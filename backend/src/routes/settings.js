import express from 'express';
import store from '../utils/store.js';

const router = express.Router();

router.get('/profile', async (req, res) => {
  const user = await store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, ...safe } = user;
  res.json(safe);
});

router.patch('/profile', async (req, res) => {
  const { firstName, lastName, company, timezone, language } = req.body;
  const updated = await store.updateUser(req.user.id, {
    profile: { ...req.user.profile, firstName, lastName, company, timezone },
    settings: { ...req.user.settings, language },
  });
  res.json(updated);
});

router.get('/integrations', (req, res) => {
  res.json({
    openai: !!process.env.OPENAI_API_KEY,
    stripe: !!process.env.STRIPE_SECRET_KEY,
  });
});

export default router;
