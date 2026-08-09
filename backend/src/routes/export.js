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

router.get('/leads', (req, res) => {
  const format = req.query.format || 'json';
  const leads = store.getLeads();

  if (format === 'csv') {
    const csv = jsonToCsv(leads, ['id', 'name', 'email', 'company', 'status', 'score', 'source', 'createdAt']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    return res.send(csv);
  }

  res.json({ exportedAt: new Date().toISOString(), count: leads.length, data: leads });
});

router.get('/campaigns', (req, res) => {
  const format = req.query.format || 'json';
  const campaigns = store.getCampaigns();

  if (format === 'csv') {
    const csv = jsonToCsv(campaigns, ['id', 'name', 'status', 'budget', 'spent', 'channels', 'createdAt']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=campaigns.csv');
    return res.send(csv);
  }

  res.json({ exportedAt: new Date().toISOString(), count: campaigns.length, data: campaigns });
});

router.get('/content', (req, res) => {
  const format = req.query.format || 'json';
  const content = store.getContent();

  if (format === 'csv') {
    const csv = jsonToCsv(content, ['id', 'title', 'type', 'status', 'language', 'createdAt']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=content.csv');
    return res.send(csv);
  }

  res.json({ exportedAt: new Date().toISOString(), count: content.length, data: content });
});

router.get('/backup', (req, res) => {
  const backup = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    data: {
      users: store.getUsers().map(u => { const { password, ...safe } = u; return safe; }),
      agents: store.getAgents(),
      campaigns: store.getCampaigns(),
      content: store.getContent(),
      leads: store.getLeads(),
      legalDocs: store.getLegalDocs(),
      tasks: store.getTasks(),
      subscriptions: store.getSubscriptions(),
      analytics: store.getAnalytics(),
      settings: store.getSettings(),
    },
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=backup.json');
  res.json(backup);
});

export default router;
