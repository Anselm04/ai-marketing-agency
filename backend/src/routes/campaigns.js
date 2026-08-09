import express from 'express';
import store from '../utils/store.js';
import agentOrchestrator from '../services/agentOrchestrator.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const campaigns = (await store.getCampaigns()).filter(c => c.owner === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(campaigns);
});

router.post('/', async (req, res) => {
  const campaign = await store.createCampaign({ ...req.body, status: 'draft', owner: req.user.id });
  res.status(201).json(campaign);
});

router.post('/:id/strategy', async (req, res) => {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  const { product, targetAudience } = req.body;
  try {
    const strategy = await agentOrchestrator.runCampaignStrategy(
      product || campaign.name,
      campaign.budget,
      campaign.platforms || [campaign.platform],
      targetAudience || campaign.targetAudience || 'general consumers'
    );
    await store.updateCampaign(campaign.id, { strategy: strategy.strategy });
    res.json({ campaign: await store.getCampaignById(campaign.id), strategy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  await store.updateCampaign(campaign.id, req.body);
  res.json(await store.getCampaignById(campaign.id));
});

router.delete('/:id', async (req, res) => {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  await store.deleteCampaign(campaign.id);
  res.json({ success: true });
});

export default router;