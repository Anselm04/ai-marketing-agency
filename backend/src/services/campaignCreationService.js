import store from '../utils/store.js';
import { assertCampaignQuota } from './planQuotaService.js';
import { withEcosystemLock } from './ecosystemLock.js';

function campaignOwner(campaign = {}) {
  return campaign.ownerId || campaign.owner || null;
}

export async function createCampaignWithinPlan(campaign = {}) {
  const ownerId = campaignOwner(campaign);
  if (!ownerId) {
    const error = new Error('Campaign owner is required.');
    error.status = 400;
    error.statusCode = 400;
    error.code = 'campaign_owner_required';
    throw error;
  }

  return withEcosystemLock(`campaign-plan-quota:${ownerId}`, async () => {
    await assertCampaignQuota(ownerId, 1);
    return store.createCampaign({
      ...campaign,
      owner: campaign.owner || ownerId,
      ownerId: campaign.ownerId || ownerId,
    });
  });
}

export default { createCampaignWithinPlan };
