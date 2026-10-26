import express from 'express';
import store from '../utils/store.js';
import { createCampaignWithinPlan } from '../services/campaignCreationService.js';
import { markManualPerformanceInput } from '../services/analyticsProvenanceService.js';

const router = express.Router();

function sanitizeCampaignInput(input = {}) {
  const safe = { ...input };
  delete safe.owner;
  delete safe.ownerId;
  delete safe.performanceProvenance;
  return safe;
}

router.get('/', async (req, res) => {
  const campaigns = (await store.getCampaignsByOwner(req.user.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(campaigns);
});

router.post('/', async (req, res, next) => {
  try {
    const safeInput = sanitizeCampaignInput(req.body);
    const campaign = await createCampaignWithinPlan({
      ...safeInput,
      performanceProvenance: markManualPerformanceInput({}, safeInput),
      status: 'draft',
      owner: req.user.id,
    });
    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res) => {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || (campaign.owner || campaign.ownerId) !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

router.patch('/:id', async (req, res) => {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || (campaign.owner || campaign.ownerId) !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  const safeInput = sanitizeCampaignInput(req.body);
  const updated = await store.updateCampaign(campaign.id, {
    ...safeInput,
    performanceProvenance: markManualPerformanceInput(campaign.performanceProvenance, safeInput),
  });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || (campaign.owner || campaign.ownerId) !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  await store.deleteCampaign(campaign.id);
  res.json({ success: true });
});

export default router;
