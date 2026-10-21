import express from 'express';
import store from '../utils/store.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { q, type } = req.query;
  if (!q || q.length < 2) return res.json({ results: [] });

  const query = q.toLowerCase();
  const ownerId = req.user.id;
  const results = [];

  if (!type || type === 'campaigns') {
    const campaigns = await store.getCampaignsByOwner(ownerId);
    results.push(...campaigns
      .filter(c => (c.name || '').toLowerCase().includes(query) || (c.description || '').toLowerCase().includes(query))
      .map(c => ({ ...c, entityType: 'campaign' })));
  }

  if (!type || type === 'content') {
    const content = await store.getContentByOwner(ownerId);
    results.push(...content
      .filter(c => (c.title || '').toLowerCase().includes(query) || (c.body || '').toLowerCase().includes(query))
      .map(c => ({ ...c, entityType: 'content' })));
  }

  if (!type || type === 'leads') {
    const leads = await store.getLeadsByOwner(ownerId);
    results.push(...leads
      .filter(l =>
        (l.firstName || '').toLowerCase().includes(query) ||
        (l.lastName || '').toLowerCase().includes(query) ||
        (l.email || '').toLowerCase().includes(query) ||
        (l.company || '').toLowerCase().includes(query)
      )
      .map(l => ({ ...l, entityType: 'lead' })));
  }

  if (!type || type === 'agents') {
    const agents = await store.getAgents();
    results.push(...agents
      .filter(a => (a.name || '').toLowerCase().includes(query) || (a.role || '').toLowerCase().includes(query))
      .map(a => ({ ...a, entityType: 'agent' })));
  }

  res.json({ results: results.slice(0, 50), query: q, total: results.length });
});

export default router;
