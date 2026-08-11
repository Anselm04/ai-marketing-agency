import express from 'express';
import store from '../utils/store.js';

const router = express.Router();

router.get('/profile', async (req, res) => {
  const user = await store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, resetToken: __, resetTokenExpires: ___, ...safe } = user;
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

router.post('/marketing-consent', async (req, res) => {
  const { optedIn } = req.body;
  const marketingConsent = {
    optedIn: !!optedIn,
    optedInAt: optedIn ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  };
  const updated = await store.updateUser(req.user.id, { marketingConsent });
  res.json({ success: true, marketingConsent: updated.marketingConsent });
});

router.get('/integrations', (req, res) => {
  res.json({
    openai: !!process.env.OPENAI_API_KEY,
    stripe: !!process.env.STRIPE_SECRET_KEY,
  });
});

export default router;
