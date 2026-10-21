import express from 'express';
import store from '../utils/store.js';
import { getUserPreferences, saveUserPreferences } from '../services/accountMemoryService.js';
import { deleteCustomerAccount } from '../services/accountLifecycleService.js';
import { createBusinessWorkspaceService } from '../services/businessWorkspaceService.js';

const router = express.Router();
const businesses = createBusinessWorkspaceService(store);

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

  const stringFields = {
    firstName: 100,
    lastName: 100,
    company: 180,
    website: 500,
    industry: 120,
    companySize: 80,
    targetAudience: 1000,
    primaryOffer: 1000,
    businessDescription: 3000,
    primaryGoal: 1000,
    preferredTone: 80,
  };
  const profilePatch = {};
  for (const [key, max] of Object.entries(stringFields)) {
    if (req.body?.[key] !== undefined) profilePatch[key] = String(req.body[key] || '').trim().slice(0, max);
  }
  if (Array.isArray(req.body?.goals)) {
    profilePatch.goals = req.body.goals.map((goal) => String(goal).trim().slice(0, 300)).filter(Boolean).slice(0, 10);
  }
  if (req.body?.onboardingCompleted === true) {
    profilePatch.onboardingCompletedAt = new Date().toISOString();
  }

  const updated = await store.updateUser(req.user.id, {
    profile: {
      ...(current.profile || {}),
      ...profilePatch,
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

router.get('/businesses', async (req, res, next) => {
  try {
    res.json(await businesses.listBusinesses(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.post('/businesses', async (req, res, next) => {
  try {
    res.status(201).json(await businesses.createBusiness(req.user.id, req.body || {}));
  } catch (error) {
    next(error);
  }
});

router.get('/businesses/:id', async (req, res, next) => {
  try {
    res.json(await businesses.requireOwnedBusiness(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
});

router.patch('/businesses/:id', async (req, res, next) => {
  try {
    res.json(await businesses.updateBusiness(req.user.id, req.params.id, req.body || {}));
  } catch (error) {
    next(error);
  }
});

router.delete('/businesses/:id', async (req, res, next) => {
  try {
    await businesses.deleteBusiness(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
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
  const [preferences, content, campaigns, leads, subscriptions, businessRows] = await Promise.all([
    getUserPreferences(owner),
    store.getContentByOwner(owner),
    store.getCampaignsByOwner(owner),
    store.getLeadsByOwner(owner),
    store.getSubscriptionsByUser(owner),
    store.getBusinessesByOwner(owner),
  ]);

  res.json({
    userId: owner,
    preferences,
    savedData: {
      businesses: businessRows.length,
      mediaAndGeneratedContent: content.length,
      automatedPostingPlans: content.filter((item) => item.kind === 'auto_post_plan').length,
      analyticsRecords: content.filter((item) => item.kind === 'auto_post_metric').length,
      campaigns: campaigns.length,
      leads: leads.length,
      subscriptions: subscriptions.length,
    },
  });
});

router.delete('/account', async (req, res, next) => {
  try {
    if (req.body?.confirmation !== 'DELETE') {
      return res.status(400).json({
        error: 'Type DELETE exactly to confirm permanent account deletion.',
        code: 'account_deletion_confirmation_required',
      });
    }
    const result = await deleteCustomerAccount({
      userId: req.user.id,
      password: req.body?.password,
    });
    return res.json({
      success: true,
      deleted: result.deleted,
      cancelledStripeSubscriptions: result.cancelledStripeSubscriptions,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/integrations', (req, res) => {
  res.json({
    openai: !!process.env.OPENAI_API_KEY,
    stripe: !!process.env.STRIPE_SECRET_KEY,
  });
});

export default router;
