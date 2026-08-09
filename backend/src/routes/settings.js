import express from 'express';
import store from '../utils/store.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

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
    tiktok: !!process.env.TIKTOK_ACCESS_TOKEN,
    meta: !!process.env.META_ACCESS_TOKEN,
    instagram: !!process.env.INSTAGRAM_ACCESS_TOKEN,
    youtube: !!process.env.YOUTUBE_API_KEY,
    shopify: !!process.env.SHOPIFY_API_KEY,
    googleSearchConsole: !!process.env.GOOGLE_SEARCH_CONSOLE_KEY,
  });
});

router.post('/api-keys', async (req, res) => {
  const { name, key } = req.body;
  const user = await store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const apiKeys = user.apiKeys || [];
  apiKeys.push({ name, key, lastUsed: new Date().toISOString() });
  await store.updateUser(req.user.id, { apiKeys });
  res.json({ success: true });
});

export default router;
