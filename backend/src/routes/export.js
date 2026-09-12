import express from 'express';
import store from '../utils/store.js';

const router = express.Router();

function jsonToCsv(rows, fields) {
  const header = fields.join(',');
  const lines = rows.map(row =>
    fields.map(f => {
      const val = row[f] ?? '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

router.get('/leads', async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const leads = await store.getLeads();

    if (format === 'csv') {
      const csv = jsonToCsv(leads, ['id', 'name', 'email', 'company', 'status', 'score', 'source', 'createdAt']);
      res.setHeader('Content-Type', 'text/csv');
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
    const campaigns = await store.getCampaigns();

    if (format === 'csv') {
      const csv = jsonToCsv(campaigns, ['id', 'name', 'status', 'budget', 'spent', 'channels', 'createdAt']);
      res.setHeader('Content-Type', 'text/csv');
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
    const content = await store.getContent();

    if (format === 'csv') {
      const csv = jsonToCsv(content, ['id', 'title', 'type', 'status', 'language', 'createdAt']);
      res.setHeader('Content-Type', 'text/csv');
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
    const [users, agents, campaigns, content, leads, legalDocs, tasks, subscriptions, analytics, settings] = await Promise.all([
      store.getUsers(),
      store.getAgents(),
      store.getCampaigns(),
      store.getContent(),
      store.getLeads(),
      store.getLegalDocs(),
      store.getTasks(),
      store.getSubscriptions(),
      store.getAnalytics(),
      store.getSettings(),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      data: {
        users: users.map(u => {
          const { password, resetToken, resetTokenExpires, ...safe } = u;
          return safe;
        }),
        agents,
        campaigns,
        content,
        leads,
        legalDocs,
        tasks,
        subscriptions,
        analytics,
        settings,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=backup.json');
    return res.json(backup);
  } catch (error) {
    return next(error);
  }
});

export default router;
