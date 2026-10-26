import { describe, expect, test } from '@jest/globals';
import { applyPublishingTruthPatch } from '../publishingTruthPatch.js';

describe('publishing truth patch', () => {
  test('converts fallback output into a blocked non-publish result', async () => {
    class Service {
      async publishExample() {
        return { fallback: true, platform: 'example', message: 'Would publish later.' };
      }
    }
    const service = applyPublishingTruthPatch(new Service());
    await expect(service.publishExample()).resolves.toMatchObject({
      success: false,
      published: false,
      blocked: true,
      code: 'provider_not_configured',
    });
  });

  test('blocks placeholder ids even when legacy code says success', async () => {
    class Service {
      async publishExample() {
        return { success: true, platform: 'example', postId: 'placeholder' };
      }
    }
    const service = applyPublishingTruthPatch(new Service());
    await expect(service.publishExample()).resolves.toMatchObject({
      success: false,
      published: false,
      blocked: true,
      postId: null,
      code: 'placeholder_result_blocked',
    });
  });

  test('blocks legacy ad creation methods instead of bypassing managed controls', async () => {
    class Service {
      async createMetaAdsCampaign() {
        return { success: true, campaignId: 'legacy-campaign' };
      }
    }
    const service = applyPublishingTruthPatch(new Service());
    await expect(service.createMetaAdsCampaign()).resolves.toMatchObject({
      success: false,
      published: false,
      blocked: true,
      code: 'managed_paid_ads_required',
    });
  });
});
