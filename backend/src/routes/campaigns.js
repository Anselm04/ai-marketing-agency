import express from 'express';
import store from '../utils/store.js';
import agentOrchestrator from '../services/agentOrchestrator.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const campaigns = store.getCampaigns().filter(c => c.owner === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(campaigns);
});

router.post('/', (req, res) => {
  const campaign = store.createCampaign({ ...req.body, status: 'draft', owner: req.user.id });
  res.status(201).json(campaign);
});

router.post('/:id/strategy', (req, res) => {
  const campaign = store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  const { product, targetAudience } = req.body;
  try {
    const strategy = agentOrchestrator.runCampaignStrategy(
      product || campaign.name,
      campaign.budget,
      campaign.platforms || [campaign.platform],
      targetAudience || campaign.targetAudience || 'general consumers'
    );
    store.updateCampaign(campaign.id, { strategy: strategy.strategy });
    res.json({ campaign: store.getCampaignById(campaign.id), strategy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', (req, res) => {
  const campaign = store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  store.updateCampaign(campaign.id, req.body);
  res.json(store.getCampaignById(campaign.id));
});

router.delete('/:id', (req, res) => {
  const campaign = store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  store.deleteCampaign(campaign.id);
  res.json({ success: true });
});

export default router;