import express from 'express';
import store from '../utils/store.js';
import { getUserPreferences } from '../services/accountMemoryService.js';

const router = express.Router();

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

function safeUser(user) {
  if (!user) return null;
  const { password, password_hash, resetToken, resetTokenExpires, ...safe } = user;
  return safe;
}

router.get('/leads', async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const leads = await store.getLeadsByOwner(req.user.id);

    if (format === 'csv') {
      const csv = jsonToCsv(leads, ['id', 'businessId', 'name', 'email', 'company', 'status', 'score', 'source', 'createdAt']);
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
      const csv = jsonToCsv(campaigns, ['id', 'businessId', 'name', 'status', 'budget', 'spent', 'channels', 'createdAt']);
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
      const csv = jsonToCsv(content, ['id', 'businessId', 'title', 'type', 'status', 'language', 'createdAt']);
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
    const [user, preferences, businesses, campaigns, content, leads, subscriptions] = await Promise.all([
      store.findUserById(owner),
      getUserPreferences(owner),
      store.getBusinessesByOwner(owner),
      store.getCampaignsByOwner(owner),
      store.getContentByOwner(owner),
      store.getLeadsByOwner(owner),
      store.getSubscriptionsByUser(owner),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: '2.1',
      scope: 'authenticated-customer-only',
      data: {
        user: safeUser(user),
        preferences,
        businesses,
        campaigns,
        content,
        leads,
        subscriptions,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=ai-marketing-agency-backup.json');
    return res.json(backup);
  } catch (error) {
    return next(error);
  }
});

export { safeCsvValue, jsonToCsv };
export default router;
