import store from '../utils/store.js';
import { assertCampaignQuota, countsTowardCampaignQuota } from './planQuotaService.js';
import { withEcosystemLock } from './ecosystemLock.js';

const rawCreateCampaign = store.createCampaign.bind(store);

function campaignOwner(campaign = {}) {
  return campaign.ownerId || campaign.owner || null;
}

function ownerRequiredError() {
  const error = new Error('Campaign owner is required.');
  error.status = 400;
  error.statusCode = 400;
  error.code = 'campaign_owner_required';
  return error;
}

function normalizedCampaign(campaign, ownerId) {
  return {
    ...campaign,
    owner: campaign.owner || ownerId,
    ownerId: campaign.ownerId || ownerId,
  };
}

async function createWithQuota(campaign = {}) {
  const ownerId = campaignOwner(campaign);
  if (!ownerId) throw ownerRequiredError();
  const normalized = normalizedCampaign(campaign, ownerId);

  if (!countsTowardCampaignQuota(normalized)) {
    return rawCreateCampaign(normalized);
  }

  return withEcosystemLock(`campaign-plan-quota:${ownerId}`, async () => {
    await assertCampaignQuota(ownerId, 1);
    return rawCreateCampaign(normalized);
  });
}

export async function createCampaignWithinPlan(campaign = {}) {
  return createWithQuota(campaign);
}

export function installCampaignCreationGuard() {
  if (store.__campaignCreationGuardInstalled) return store;

  store.createCampaign = async function guardedCreateCampaign(campaign = {}) {
    return createWithQuota(campaign);
  };

  Object.defineProperty(store, '__campaignCreationGuardInstalled', {
    value: true,
    enumerable: false,
  });
  return store;
}

export default { createCampaignWithinPlan, installCampaignCreationGuard };
