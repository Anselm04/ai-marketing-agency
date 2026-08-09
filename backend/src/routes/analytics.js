import express from 'express';
import store from '../utils/store.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const campaigns = store.getCampaigns().filter(c => c.owner === req.user.id);
  const leads = store.getLeads().filter(l => l.owner === req.user.id);
  res.json({
    campaigns: campaigns.length,
    leads: leads.length,
    revenue: campaigns.reduce((s, c) => s + (c.revenue || 0), 0),
    spend: campaigns.reduce((s, c) => s + (c.spend || 0), 0),
  });
});

router.get('/dashboard', (req, res) => {
  const campaigns = store.getCampaigns().filter(c => c.owner === req.user.id);
  const totalRevenue = campaigns.reduce((sum, c) => sum + (c.revenue || 0), 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
  const overallRoi = totalSpend > 0 ? (totalRevenue - totalSpend) / totalSpend : 0;

  const platformBreakdown = campaigns.reduce((acc, c) => {
    c.platforms?.forEach(p => {
      if (!acc[p]) acc[p] = { platform: p, spend: 0, revenue: 0 };
      acc[p].spend += c.spend || 0;
      acc[p].revenue += c.revenue || 0;
    });
    return acc;
  }, {});

  const leads = store.getLeads().filter(l => l.owner === req.user.id && new Date(l.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  res.json({
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'running').length,
    totalSpend,
    totalRevenue,
    overallRoi: parseFloat(overallRoi.toFixed(2)),
    impressions: totalImpressions,
    clicks: totalClicks,
    conversions: totalConversions,
    leads: leads.length,
    platformBreakdown: Object.values(platformBreakdown).map(p => ({ ...p, roi: p.spend > 0 ? parseFloat(((p.revenue - p.spend) / p.spend).toFixed(2)) : 0 })),
    dailyTrends: [
      { date: '2025-07-01', spend: 800, revenue: 2100 },
      { date: '2025-07-02', spend: 950, revenue: 2400 },
      { date: '2025-07-03', spend: 1100, revenue: 3100 },
      { date: '2025-07-04', spend: 900, revenue: 2800 },
      { date: '2025-07-05', spend: 1200, revenue: 3400 },
      { date: '2025-07-06', spend: 1300, revenue: 3600 },
      { date: '2025-07-07', spend: 1150, revenue: 3200 },
    ],
  });
});

export default router;