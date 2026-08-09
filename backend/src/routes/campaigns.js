import express from 'express';

const router = express.Router();

let campaigns = [
  { id: 1, name: 'App Launch Booster', platform: 'TikTok', status: 'running', budget: 5000, spend: 2340, impressions: 450000, clicks: 12500, conversions: 340, roi: 2.4, createdAt: '2025-07-01' },
  { id: 2, name: 'SEO Content Wave', platform: 'Google', status: 'running', budget: 3000, spend: 1200, impressions: 890000, clicks: 23400, conversions: 890, roi: 3.1, createdAt: '2025-07-05' },
  { id: 3, name: 'Instagram Reels Push', platform: 'Instagram', status: 'paused', budget: 2000, spend: 1800, impressions: 320000, clicks: 8900, conversions: 210, roi: 1.8, createdAt: '2025-07-10' },
];

router.get('/', (req, res) => {
  res.json(campaigns);
});

router.post('/', (req, res) => {
  const campaign = {
    id: campaigns.length + 1,
    ...req.body,
    status: 'draft',
    createdAt: new Date().toISOString().split('T')[0]
  };
  campaigns.push(campaign);
  res.status(201).json(campaign);
});

router.patch('/:id', (req, res) => {
  const campaign = campaigns.find(c => c.id === parseInt(req.params.id));
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  Object.assign(campaign, req.body);
  res.json(campaign);
});

router.delete('/:id', (req, res) => {
  campaigns = campaigns.filter(c => c.id !== parseInt(req.params.id));
  res.json({ success: true });
});

export default router;