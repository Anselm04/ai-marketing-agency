import express from 'express';
import store from '../utils/store.js';
import { createCampaignWithinPlan } from '../services/campaignCreationService.js';
import { markManualPerformanceInput } from '../services/analyticsProvenanceService.js';
import { managerCustomerCommand } from '../services/managerCustomerBridgeService.js';
import { withEcosystemLock } from '../services/ecosystemLock.js';

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

// Customer-requested draft creation only; the Manager subscription and
// proposal approval are reverified server-side. No social publication, spend,
// or background automation is authorised by this route.
router.post('/from-manager-proposal', async (req, res, next) => {
  try {
    const proposalId = req.body?.id;
    if (typeof proposalId !== 'string' || !/^[a-f0-9-]{36}$/i.test(proposalId)) {
      return res.status(400).json({ error: 'A valid approved proposal is required.' });
    }
    const owner = req.user.id;
    const sourceRequestId = 'manager-proposal:' + proposalId;
    const result = await withEcosystemLock('manager-draft:' + owner + ':' + proposalId, async () => {
      const previous = (await store.getCampaignsByOwner(owner)).find(x => x.sourceRequestId === sourceRequestId);
      if (previous) return { campaign: previous, created: false };
      const [proposals, permission] = await Promise.all([
        managerCustomerCommand({userId:owner,operation:'campaign.list',payload:{}}),
        managerCustomerCommand({userId:owner,operation:'automation.status',payload:{}}),
      ]);
      const proposal = Array.isArray(proposals) && proposals.find(p => p.id === proposalId && p.status === 'approved_for_production');
      if (!proposal || permission?.paidManagerAutomationVerified !== true || permission.effectiveMode === 'manual' || !permission.policy?.actions?.includes('draft_campaigns')) {
        const error = new Error('Manager approval and active automation access are required to create this draft.');
        error.status = 403;
        throw error;
      }
      const campaign = await createCampaignWithinPlan({
        owner,
        ownerId: owner,
        name: String(proposal.title || 'Manager campaign proposal').slice(0,140),
        source: 'trillionai_manager_customer',
        sourceRequestId,
        status: 'draft',
        budget: 0,
        platforms: proposal.platforms || [],
        targetAudience: String(proposal.targetAudience || '').slice(0,1000),
        goal: String(proposal.objective || '').slice(0,1000),
        description: String(proposal.offer || '').slice(0,1000),
        performanceProvenance: markManualPerformanceInput({}, {}),
      });
      return { campaign, created: true };
    });
    return res.status(result.created ? 201 : 200).json({ ...result, published: false, paidAdvertisingAuthorized: false });
  } catch (error) {
    return next(error);
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
