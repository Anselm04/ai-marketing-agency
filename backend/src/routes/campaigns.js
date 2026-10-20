import express from 'express';
import store from '../utils/store.js';
import { assertCampaignQuota } from '../services/planQuotaService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const campaigns = (await store.getCampaigns()).filter(c => c.owner === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(campaigns);
});

router.post('/', async (req, res, next) => {
  try {
    await assertCampaignQuota(req.user.id, 1);
    const campaign = await store.createCampaign({ ...req.body, status: 'draft', owner: req.user.id });
    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res) => {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

router.patch('/:id', async (req, res) => {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  const updated = await store.updateCampaign(campaign.id, req.body);
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  await store.deleteCampaign(campaign.id);
  res.json({ success: true });
});

export default router;
