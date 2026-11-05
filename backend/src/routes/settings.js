import express from 'express';
import store from '../utils/store.js';
import { getUserPreferences, saveUserPreferences } from '../services/accountMemoryService.js';
import { deleteCustomerAccount } from '../services/accountLifecycleService.js';

const router = express.Router();


const growthLevels = new Set(['none', 'summary', 'counts']);
const growthCadences = new Set(['off', 'weekly', 'monthly']);
const growthMethods = new Set(['direction', 'scale', 'count']);

function safeGrowth(profile = {}) {
  const settings = profile.customerGrowthSettings || { level: 'none', cadence: 'off', acknowledgedAt: null };
  return {
    settings,
    reports: (profile.customerGrowthReports || []).map((record) => ({
      period: record.period,
      method: record.method,
      value: record.value,
      note: record.note,
      updatedAt: record.updatedAt,
      source: 'customer_self_report',
      verifiedRevenue: false,
    })),
  };
}

// Separate from advertising metrics: this is voluntary, unverified customer feedback.
// Data is stored under the authenticated customer's existing profile.
router.get('/growth', async (req, res) => {
  const user = await store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(safeGrowth(user.profile));
});

router.put('/growth/preferences', async (req, res) => {
  const { level, cadence, understoodLimitations } = req.body || {};
  if (!growthLevels.has(level) || !growthCadences.has(cadence) || understoodLimitations !== true
      || ((level === 'none') !== (cadence === 'off'))) {
    return res.status(400).json({ error: 'Select a reporting level and frequency, and acknowledge measurement limitations.' });
  }
  const user = await store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const settings = { level, cadence, acknowledgedAt: new Date().toISOString(), version: 'growth-consent-v1' };
  await store.updateUser(req.user.id, { profile: { ...(user.profile || {}), customerGrowthSettings: settings } });
  return res.json({ settings });
});

router.post('/growth/reports', async (req, res) => {
  const user = await store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const profile = user.profile || {};
  const settings = profile.customerGrowthSettings || {};
  if (settings.level === 'none' || settings.cadence === 'off' || !growthLevels.has(settings.level)) {
    return res.status(403).json({ error: 'Enable voluntary growth reporting before submitting feedback.' });
  }
  const { period, method, value, note = '' } = req.body || {};
  if (!growthMethods.has(method) || typeof period !== 'string'
      || (settings.cadence === 'monthly' && !/^\\d{4}-(0[1-9]|1[0-2])$/.test(period))
      || (settings.cadence === 'weekly' && !/^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$/.test(period))
      || (method === 'direction' && !['up', 'same', 'down'].includes(value))
      || (method === 'scale' && (!Number.isInteger(value) || value < 1 || value > 5))
      || (method === 'count' && (settings.level !== 'counts' || !Number.isSafeInteger(value) || Math.abs(value) > 1000000))
      || typeof note !== 'string' || note.length > 300) {
    return res.status(400).json({ error: 'Invalid voluntary business-growth report.' });
  }
  const existing = profile.customerGrowthReports || [];
  if (existing.some((record) => record.period === period)) {
    return res.status(409).json({ error: 'Feedback for this period already exists; please contact support to correct it.' });
  }
  const report = { period, method, value, note: note.trim(), updatedAt: new Date().toISOString() };
  const reports = [...existing, report].slice(-104);
  await store.updateUser(req.user.id, { profile: { ...profile, customerGrowthReports: reports } });
  return res.status(201).json({ ...report, source: 'customer_self_report', verifiedRevenue: false });
});

router.delete('/growth/reports', async (req, res) => {
  const user = await store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await store.updateUser(req.user.id, { profile: { ...(user.profile || {}), customerGrowthReports: [] } });
  return res.json({ deleted: true });
});

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
    store.getContentByOwner(owner),
    store.getCampaignsByOwner(owner),
    store.getLeadsByOwner(owner),
    store.getSubscriptionsByUser(owner),
  ]);

  res.json({
    userId: owner,
    preferences,
    savedData: {
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
