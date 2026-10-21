import express from 'express';
import store from '../utils/store.js';
import { aggregateCampaignPerformance } from '../services/analyticsProvenanceService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const [campaigns, leads] = await Promise.all([
    store.getCampaignsByOwner(req.user.id),
    store.getLeadsByOwner(req.user.id),
  ]);
  const performance = aggregateCampaignPerformance(campaigns);
  res.json({
    campaigns: campaigns.length,
    leads: leads.length,
    revenue: performance.verified.revenueCampaigns > 0 ? performance.verified.revenue : null,
    spend: performance.verified.spendCampaigns > 0 ? performance.verified.spend : null,
    reportedRevenue: performance.reported.revenue,
    reportedSpend: performance.reported.spend,
    performance,
  });
});

router.get('/dashboard', async (req, res) => {
  const [campaigns, leads] = await Promise.all([
    store.getCampaignsByOwner(req.user.id),
    store.getLeadsByOwner(req.user.id),
  ]);
  const performance = aggregateCampaignPerformance(campaigns);
  const recentLeadCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  res.json({
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'running').length,
    totalSpend: performance.verified.spendCampaigns > 0 ? performance.verified.spend : null,
    totalRevenue: performance.verified.revenueCampaigns > 0 ? performance.verified.revenue : null,
    overallRoi: performance.verified.roi,
    reportedSpend: performance.reported.spend,
    reportedRevenue: performance.reported.revenue,
    provenance: performance.provenance,
    verifiedCampaigns: performance.verified.pairedCampaigns,
    leads: leads.filter(l => new Date(l.createdAt) >= recentLeadCutoff).length,
  });
});

export default router;
