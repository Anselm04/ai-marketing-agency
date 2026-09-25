import express from 'express';
import store from '../utils/store.js';
import { getUserPreferences, saveUserPreferences } from '../services/accountMemoryService.js';

const router = express.Router();

router.get('/profile', async (req, res) => {
  const user = await store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, resetToken, resetTokenExpires, ...safe } = user;
  const preferences = await getUserPreferences(req.user.id);
  res.json({ ...safe, preferences });
});

router.patch('/profile', async (req, res) => {
  const current = await store.findUserById(req.user.id);
  if (!current) return res.status(404).json({ error: 'User not found' });

  const { firstName, lastName, company } = req.body || {};
  const updated = await store.updateUser(req.user.id, {
    profile: {
      ...(current.profile || {}),
      ...(firstName !== undefined ? { firstName: String(firstName).slice(0, 100) } : {}),
      ...(lastName !== undefined ? { lastName: String(lastName).slice(0, 100) } : {}),
      ...(company !== undefined ? { company: String(company).slice(0, 180) } : {}),
    },
  });

  const preferencePatch = {};
  for (const key of [
    'language',
    'timezone',
    'theme',
    'postingWindowStartHour',
    'postingWindowEndHour',
    'aiOptimizationEnabled',
    'emailNotifications',
    'marketingNotifications',
    'dashboard',
  ]) {
    if (req.body?.[key] !== undefined) preferencePatch[key] = req.body[key];
  }
  const preferences = Object.keys(preferencePatch).length
    ? await saveUserPreferences(req.user.id, preferencePatch)
    : await getUserPreferences(req.user.id);

  res.json({ ...updated, preferences });
});

router.get('/preferences', async (req, res) => {
  const preferences = await getUserPreferences(req.user.id);
  res.json({ preferences });
});

router.patch('/preferences', async (req, res) => {
  const preferences = await saveUserPreferences(req.user.id, req.body || {});
  res.json({ preferences });
});

router.get('/account-memory', async (req, res) => {
  const owner = req.user.id;
  const [preferences, content, campaigns, leads, subscriptions] = await Promise.all([
    getUserPreferences(owner),
    store.getContent(),
    store.getCampaigns(),
    store.getLeads(),
    store.getSubscriptionsByUser(owner),
  ]);

  res.json({
    userId: owner,
    preferences,
    savedData: {
      mediaAndGeneratedContent: content.filter((item) => item.owner === owner || item.ownerId === owner).length,
      automatedPostingPlans: content.filter(
        (item) => (item.owner === owner || item.ownerId === owner) && item.kind === 'auto_post_plan',
      ).length,
      analyticsRecords: content.filter(
        (item) => (item.owner === owner || item.ownerId === owner) && item.kind === 'auto_post_metric',
      ).length,
      campaigns: campaigns.filter((item) => item.owner === owner || item.ownerId === owner).length,
      leads: leads.filter((item) => item.owner === owner || item.ownerId === owner).length,
      subscriptions: subscriptions.length,
    },
  });
});

router.get('/integrations', (req, res) => {
  res.json({
    openai: !!process.env.OPENAI_API_KEY,
    stripe: !!process.env.STRIPE_SECRET_KEY,
  });
});

export default router;
