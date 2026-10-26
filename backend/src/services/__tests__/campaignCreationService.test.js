import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const rawCreateCampaign = jest.fn(async (campaign) => ({ id: `campaign-${Math.random()}`, ...campaign }));
const assertCampaignQuota = jest.fn(async () => ({ quota: { allowed: true } }));
const countsTowardCampaignQuota = jest.fn((campaign) => campaign.kind !== 'ai-course-factory');
const withEcosystemLock = jest.fn(async (_key, task) => task());
const store = { createCampaign: rawCreateCampaign };

jest.unstable_mockModule('../../utils/store.js', () => ({ default: store }));
jest.unstable_mockModule('../planQuotaService.js', () => ({ assertCampaignQuota, countsTowardCampaignQuota }));
jest.unstable_mockModule('../ecosystemLock.js', () => ({ withEcosystemLock }));

const {
  createCampaignWithinPlan,
  installCampaignCreationGuard,
} = await import('../campaignCreationService.js');

beforeEach(() => {
  rawCreateCampaign.mockClear();
  assertCampaignQuota.mockClear();
  countsTowardCampaignQuota.mockClear();
  withEcosystemLock.mockClear();
});

describe('campaign creation plan guard', () => {
  test('checks the plan quota inside a per-customer lock before persistence', async () => {
    const result = await createCampaignWithinPlan({ owner: 'user-1', name: 'Campaign' });

    expect(withEcosystemLock).toHaveBeenCalledWith('campaign-plan-quota:user-1', expect.any(Function));
    expect(assertCampaignQuota).toHaveBeenCalledWith('user-1', 1);
    expect(rawCreateCampaign).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'user-1',
      ownerId: 'user-1',
      name: 'Campaign',
    }));
    expect(result.name).toBe('Campaign');
  });

  test('never persists a campaign when the plan quota rejects creation', async () => {
    assertCampaignQuota.mockRejectedValueOnce(Object.assign(new Error('limit reached'), {
      status: 402,
      code: 'plan_quota_exceeded',
    }));

    await expect(createCampaignWithinPlan({ owner: 'user-2', name: 'Blocked' }))
      .rejects.toMatchObject({ code: 'plan_quota_exceeded' });
    expect(rawCreateCampaign).not.toHaveBeenCalled();
  });

  test('requires an owner so a campaign cannot bypass customer accounting', async () => {
    await expect(createCampaignWithinPlan({ name: 'Ownerless' }))
      .rejects.toMatchObject({ code: 'campaign_owner_required', statusCode: 400 });
    expect(assertCampaignQuota).not.toHaveBeenCalled();
    expect(rawCreateCampaign).not.toHaveBeenCalled();
  });

  test('does not charge Course Factory projects against the marketing campaign allowance', async () => {
    const result = await createCampaignWithinPlan({ owner: 'user-course', kind: 'ai-course-factory', name: 'Course project' });

    expect(countsTowardCampaignQuota).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ai-course-factory' }));
    expect(assertCampaignQuota).not.toHaveBeenCalled();
    expect(withEcosystemLock).not.toHaveBeenCalled();
    expect(rawCreateCampaign).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'user-course',
      ownerId: 'user-course',
      kind: 'ai-course-factory',
    }));
    expect(result.kind).toBe('ai-course-factory');
  });

  test('runtime installer makes direct store.createCampaign calls use the same guard', async () => {
    installCampaignCreationGuard();
    await store.createCampaign({ ownerId: 'user-3', name: 'Internal feature campaign' });

    expect(withEcosystemLock).toHaveBeenCalledWith('campaign-plan-quota:user-3', expect.any(Function));
    expect(assertCampaignQuota).toHaveBeenCalledWith('user-3', 1);
    expect(rawCreateCampaign).toHaveBeenCalledWith(expect.objectContaining({ owner: 'user-3', ownerId: 'user-3' }));
  });
});
