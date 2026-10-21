import express from 'express';
import store from '../utils/store.js';
import { assertCampaignQuota } from '../services/planQuotaService.js';
import { markManualPerformanceInput } from '../services/analyticsProvenanceService.js';
import { createBusinessWorkspaceService } from '../services/businessWorkspaceService.js';

const router = express.Router();
const businesses = createBusinessWorkspaceService(store);

function sanitizeCampaignInput(input = {}) {
  const safe = { ...input };
  delete safe.owner;
  delete safe.ownerId;
  delete safe.performanceProvenance;
  return safe;
}

router.get('/', async (req, res, next) => {
  try {
    const businessId = req.query.businessId ? String(req.query.businessId) : null;
    if (businessId) await businesses.requireOwnedBusiness(req.user.id, businessId);
    const campaigns = businesses.filterByBusiness(
      await store.getCampaignsByOwner(req.user.id),
      businessId,
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    await assertCampaignQuota(req.user.id, 1);
    const safeInput = sanitizeCampaignInput(req.body);
    if (safeInput.businessId) {
      await businesses.requireOwnedBusiness(req.user.id, safeInput.businessId);
    }
    const campaign = await store.createCampaign({
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
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

router.patch('/:id', async (req, res, next) => {
  try {
    const campaign = await store.getCampaignById(req.params.id);
    if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
    const safeInput = sanitizeCampaignInput(req.body);
    if (safeInput.businessId) {
      await businesses.requireOwnedBusiness(req.user.id, safeInput.businessId);
    }
    const updated = await store.updateCampaign(campaign.id, {
      ...safeInput,
      performanceProvenance: markManualPerformanceInput(campaign.performanceProvenance, safeInput),
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res) => {
  const campaign = await store.getCampaignById(req.params.id);
  if (!campaign || campaign.owner !== req.user.id) return res.status(404).json({ error: 'Campaign not found' });
  await store.deleteCampaign(campaign.id);
  res.json({ success: true });
});

export default router;
