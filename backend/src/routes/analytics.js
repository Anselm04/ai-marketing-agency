import express from 'express';
import store from '../utils/store.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const campaigns = (await store.getCampaigns()).filter(c => c.owner === req.user.id);
  const leads = (await store.getLeads()).filter(l => l.owner === req.user.id);
  res.json({
    campaigns: campaigns.length,
    leads: leads.length,
    revenue: campaigns.reduce((s, c) => s + (c.revenue || 0), 0),
    spend: campaigns.reduce((s, c) => s + (c.spend || 0), 0),
  });
});

router.get('/dashboard', async (req, res) => {
  const campaigns = (await store.getCampaigns()).filter(c => c.owner === req.user.id);
  const totalRevenue = campaigns.reduce((sum, c) => sum + (c.revenue || 0), 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const overallRoi = totalSpend > 0 ? (totalRevenue - totalSpend) / totalSpend : 0;

  res.json({
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'running').length,
    totalSpend,
    totalRevenue,
    overallRoi: parseFloat(overallRoi.toFixed(2)),
    leads: (await store.getLeads()).filter(l => l.owner === req.user.id && new Date(l.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
  });
});

export default router;
