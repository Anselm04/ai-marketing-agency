import express from 'express';
import store from '../utils/store.js';
import { CATALOG, findItem } from '../config/stripeCatalog.js';
import { requireOwner, mintGodCode, hashGodCode, encryptGodCode } from '../utils/owner.js';
import { redeemGodCodeForUser } from '../services/godCodeService.js';

const router = express.Router();
router.use(requireOwner);

const SKUS = [...CATALOG.plans, ...CATALOG.credits];

router.get('/me', async (req, res) => {
  res.json({ email: req.user.email, isOwner: true });
});

router.get('/skus', (req, res) => {
  res.json(SKUS.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.interval ? 'plan' : 'credits',
    amount: item.amount,
    credits: item.credits,
    lookup_key: item.lookup_key,
  })));
});

router.get('/users', async (req, res) => {
  const users = (await store.getUsers())
    .map((u) => {
      const { password, resetToken, resetTokenExpires, ...safe } = u;
      return safe;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 200);
  res.json(users);
});

router.get('/overview', async (req, res) => {
  res.json(await analyticsPayload());
});

router.get('/analytics', async (req, res) => {
  res.json(await analyticsPayload());
});

async function analyticsPayload() {
  const users = await store.getUsers();
  const campaigns = await store.getCampaigns();
  const agents = await store.getAgents();
  const tasks = await store.getTasks();
  const leads = await store.getLeads();
  const subscriptions = await store.getSubscriptions();
  const codes = await store.getGodCodes();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentSignups7d = users.filter((u) => new Date(u.createdAt).getTime() >= weekAgo).length;
  const activeSubs = subscriptions.filter((s) => s.status === 'active').length;
  const planCounts = {};
  for (const s of subscriptions) {
    const key = `${s.plan || 'none'}:${s.status || 'none'}`;
    planCounts[key] = (planCounts[key] || 0) + 1;
  }
  const recentUsers = users
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50)
    .map((u) => {
      const sub = subscriptions.find((s) => s.userId === u.id || s.user === u.id);
      return {
        id: u.id,
        email: u.email,
        name: [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(' ') || null,
        createdAt: u.createdAt,
        plan: sub?.plan || u.plan || 'none',
        status: sub?.status || 'none',
        credits: u.credits || 0,
        godGrant: sub?.godGrant || u.godGrant || null,
      };
    });
  return {
    users: users.length,
    campaigns: campaigns.length,
    agents: agents.length,
    tasks: tasks.length,
    leads: leads.length,
    subscriptions: subscriptions.length,
    counts: {
      totalUsers: users.length,
      recentSignups7d,
      campaigns: campaigns.length,
      agents: agents.length,
      tasks: tasks.length,
      leads: leads.length,
      activeSubscriptions: activeSubs,
      godCodes: codes.length,
      unusedCodes: codes.filter((c) => !c.redeemedAt && !c.isUsed).length,
    },
    subscriptionsByTier: Object.entries(planCounts).map(([key, count]) => {
      const [tier, status] = key.split(':');
      return { tier, status, count };
    }),
    recentUsers,
  };
}

router.post('/god-codes/redeem-owner', async (req, res) => {
  try {
    const result = await redeemGodCodeForUser(req.user.id, req.body?.code);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to redeem that code.' });
  }
});

router.get('/god-codes', async (req, res) => {
  const codes = await store.getGodCodes();
  const listed = codes
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((c) => ({
      id: c.id,
      sku: c.sku || c.grantType,
      grantType: c.grantType,
      kind: c.kind || (String(c.grantType || '').startsWith('credits') ? 'credits' : 'plan'),
      credits: c.credits || 0,
      status: c.redeemedAt || c.isUsed ? 'redeemed' : 'unused',
      createdAt: c.createdAt,
      redeemedAt: c.redeemedAt || c.usedAt || null,
      redeemedByUserId: c.redeemedByUserId || c.usedByUserId || null,
      accessMode: c.accessMode || 'lifetime',
      durationDays: c.durationDays || null,
    }));
  res.json(listed);
});

router.post('/god-codes', async (req, res) => {
  const sku = String(req.body?.sku || req.body?.grantType || '').trim();
  const item = findItem({ id: sku });
  if (!item) {
    return res.status(400).json({ error: 'Unknown SKU. Use starter, growth, agency, enterprise, credits_100, credits_300, or credits_750.' });
  }
  const isPlan = Boolean(item.interval);
  const requestedMode = String(req.body?.accessMode || 'lifetime').toLowerCase();
  const accessMode = isPlan && requestedMode === 'timed' ? 'timed' : 'lifetime';
  let durationDays = null;
  if (accessMode === 'timed') {
    durationDays = Number(req.body?.durationDays);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
      return res.status(400).json({ error: 'Timed access duration must be between 1 and 365 days.' });
    }
  }

  const rawCode = mintGodCode();
  const hash = hashGodCode(rawCode);
  const encryptedCode = encryptGodCode(rawCode);
  const kind = item.interval ? 'plan' : 'credits';
  const row = await store.createGodCode({
    hash,
    encryptedCode,
    sku: item.id,
    grantType: item.id,
    kind,
    lookup_key: item.lookup_key,
    credits: item.credits || 0,
    isUsed: false,
    accessMode,
    durationDays,
  });
  res.status(201).json({
    id: row.id,
    code: rawCode,
    sku: item.id,
    grantType: item.id,
    kind,
    name: item.name,
    credits: item.credits || 0,
    accessMode,
    durationDays,
    createdAt: row.createdAt,
  });
});

export default router;
