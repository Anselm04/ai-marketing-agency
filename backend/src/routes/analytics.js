import express from 'express';

const router = express.Router();

router.get('/dashboard', (req, res) => {
  res.json({
    totalCampaigns: 12,
    activeCampaigns: 5,
    totalSpend: 45600,
    totalRevenue: 128900,
    overallRoi: 2.8,
    impressions: 2340000,
    clicks: 67800,
    conversions: 3450,
    platformBreakdown: [
      { platform: 'TikTok', spend: 15000, revenue: 42000, roi: 2.8 },
      { platform: 'Instagram', spend: 12000, revenue: 31200, roi: 2.6 },
      { platform: 'Google', spend: 11000, revenue: 38500, roi: 3.5 },
      { platform: 'YouTube', spend: 7600, revenue: 17200, roi: 2.3 },
    ],
    dailyTrends: [
      { date: '2025-07-01', spend: 800, revenue: 2100 },
      { date: '2025-07-02', spend: 950, revenue: 2400 },
      { date: '2025-07-03', spend: 1100, revenue: 3100 },
      { date: '2025-07-04', spend: 900, revenue: 2800 },
      { date: '2025-07-05', spend: 1200, revenue: 3400 },
      { date: '2025-07-06', spend: 1300, revenue: 3600 },
      { date: '2025-07-07', spend: 1150, revenue: 3200 },
    ]
  });
});

export default router;