import { describe, expect, test } from '@jest/globals';
import { resumeManagedPaidAdCampaign } from '../managedPaidAdsResumeService.js';

describe('managed paid advertising resume', () => {
  test('treats an absent provider campaign as already resumed without a provider call', async () => {
    await expect(resumeManagedPaidAdCampaign('user-1', { provider: 'meta' }))
      .resolves.toEqual({ resumed: true, alreadyAbsent: true });
  });

  test('rejects unsupported advertising providers', async () => {
    await expect(resumeManagedPaidAdCampaign('user-1', {
      provider: 'unsupported',
      providerCampaignId: 'campaign-1',
    })).rejects.toMatchObject({ code: 'paid_ads_provider_invalid' });
  });
});
