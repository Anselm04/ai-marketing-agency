import express from 'express';
import store from '../utils/store.js';
import { getUserPreferences } from '../services/accountMemoryService.js';
import { listUsageEvents, usageSummary } from '../services/usageMeteringService.js';

const router = express.Router();

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'resettoken',
  'resettokenexpires',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'oauthtoken',
  'clientsecret',
  'apikey',
  'authorization',
  'secretcipher',
  'encryptedcode',
  'awsaccesskeyid',
  'awssecretaccesskey',
]);

function safeCsvValue(value) {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function jsonToCsv(rows, fields) {
  const header = fields.join(',');
  const lines = rows.map((row) => fields.map((field) => safeCsvValue(row[field])).join(','));
  return [header, ...lines].join('\n');
}

function normalizedKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveKey(key) {
  const normalized = normalizedKey(key);
  return SENSITIVE_KEYS.has(normalized)
    || normalized.endsWith('token')
    || normalized.endsWith('secret')
    || normalized.endsWith('privatekey');
}

export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  const safe = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKey(key)) continue;
    safe[key] = redactSecrets(child);
  }
  return safe;
}

function safeUser(user) {
  return user ? redactSecrets(user) : null;
}

function belongsToUser(record, userId) {
  return String(record?.ownerId ?? record?.owner ?? record?.userId ?? record?.user ?? '') === String(userId);
}

function organizationBelongsToUser(org, userId) {
  if (String(org?.ownerId ?? org?.owner ?? '') === String(userId)) return true;
  return Array.isArray(org?.members)
    && org.members.some((member) => String(member?.userId ?? member?.id ?? '') === String(userId));
}

export function personalOrganizationView(org, userId) {
  if (!organizationBelongsToUser(org, userId)) return null;
  const members = Array.isArray(org?.members)
    ? org.members.filter((member) => String(member?.userId ?? member?.id ?? '') === String(userId))
    : [];
  return {
    ...org,
    members,
    membershipExportScope: 'requesting_customer_only',
  };
}

export function personalInvites(invites = [], user = null) {
  const email = String(user?.email || '').trim().toLowerCase();
  const userId = String(user?.id || '').trim();
  return invites.filter((invite) => {
    const inviteEmail = String(invite?.email || '').trim().toLowerCase();
    const inviteUserId = String(invite?.userId ?? invite?.user ?? '').trim();
    return Boolean((email && inviteEmail === email) || (userId && inviteUserId === userId));
  });
}

function userAnalytics(analytics, userId) {
  if (!analytics || typeof analytics !== 'object') return {};
  return Object.fromEntries(Object.entries(analytics).filter(([, value]) => belongsToUser(value, userId)));
}

router.get('/leads', async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const leads = await store.getLeadsByOwner(req.user.id);

    if (format === 'csv') {
      const csv = jsonToCsv(leads, ['id', 'name', 'email', 'company', 'status', 'score', 'source', 'createdAt']);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
      return res.send(csv);
    }

    return res.json({ exportedAt: new Date().toISOString(), count: leads.length, data: leads });
  } catch (error) {
    return next(error);
  }
});

router.get('/campaigns', async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const campaigns = await store.getCampaignsByOwner(req.user.id);

    if (format === 'csv') {
      const csv = jsonToCsv(campaigns, ['id', 'name', 'status', 'budget', 'spent', 'channels', 'createdAt']);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=campaigns.csv');
      return res.send(csv);
    }

    return res.json({ exportedAt: new Date().toISOString(), count: campaigns.length, data: campaigns });
  } catch (error) {
    return next(error);
  }
});

router.get('/content', async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const content = await store.getContentByOwner(req.user.id);

    if (format === 'csv') {
      const csv = jsonToCsv(content, ['id', 'title', 'type', 'status', 'language', 'createdAt']);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=content.csv');
      return res.send(csv);
    }

    return res.json({ exportedAt: new Date().toISOString(), count: content.length, data: content });
  } catch (error) {
    return next(error);
  }
});

router.get('/backup', async (req, res, next) => {
  try {
    const owner = req.user.id;
    const [
      user,
      preferences,
      campaigns,
      content,
      leads,
      subscriptions,
      socialPosts,
      socialConnections,
      videos,
      legalDocs,
      tasks,
      organizations,
      invites,
      analytics,
      usageEvents,
      currentUsage,
    ] = await Promise.all([
      store.findUserById(owner),
      getUserPreferences(owner),
      store.getCampaignsByOwner(owner),
      store.getContentByOwner(owner),
      store.getLeadsByOwner(owner),
      store.getSubscriptionsByUser(owner),
      typeof store.getSocialPostsByOwner === 'function' ? store.getSocialPostsByOwner(owner) : Promise.resolve([]),
      typeof store.getSocialConnectionsByOwner === 'function' ? store.getSocialConnectionsByOwner(owner) : Promise.resolve([]),
      typeof store.getVideosByOwner === 'function' ? store.getVideosByOwner(owner) : Promise.resolve([]),
      store.getLegalDocs(),
      store.getTasks(),
      store.getOrganizations(),
      Promise.resolve(store.getInvites()),
      store.getAnalytics(),
      listUsageEvents(owner),
      usageSummary(owner),
    ]);

    const customerOrganizations = (organizations || [])
      .map((org) => personalOrganizationView(org, owner))
      .filter(Boolean);
    const customerInvites = personalInvites(invites || [], user);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: '3.1',
      scope: 'authenticated-customer-only',
      credentialsIncluded: false,
      thirdPartyMemberDataIncluded: false,
      note: 'Authentication secrets, OAuth tokens, API keys, passwords, signing secrets and other members’ personal records are intentionally excluded.',
      data: redactSecrets({
        user: safeUser(user),
        preferences,
        campaigns,
        content,
        leads,
        subscriptions,
        socialPosts,
        socialConnections,
        videos,
        legalDocuments: (legalDocs || []).filter((doc) => belongsToUser(doc, owner)),
        tasks: (tasks || []).filter((task) => belongsToUser(task, owner)),
        organizations: customerOrganizations,
        invites: customerInvites,
        analytics: userAnalytics(analytics, owner),
        usageEvents,
        usageSummary: currentUsage,
      }),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=ai-marketing-agency-backup.json');
    return res.json(backup);
  } catch (error) {
    return next(error);
  }
});

export {
  belongsToUser,
  isSensitiveKey,
  jsonToCsv,
  organizationBelongsToUser,
  safeCsvValue,
  userAnalytics,
};
export default router;
