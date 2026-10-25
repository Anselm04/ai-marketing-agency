import { afterEach, describe, expect, test } from '@jest/globals';
import { paidAdServiceFeeCheckoutPolicy } from '../paidAdvertisingService.js';

describe('paid advertising service-fee checkout safety', () => {
  const original = process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST;

  afterEach(() => {
    if (original == null) delete process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST;
    else process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST = original;
  });

  test('blocks charging the service fee when the provider is not approved for managed billing', () => {
    delete process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST;
    expect(paidAdServiceFeeCheckoutPolicy('meta')).toEqual({
      allowed: false,
      code: 'paid_ads_provider_adapter_required',
    });
  });

  test('does not let an environment allowlist pretend an unimplemented provider adapter is ready', () => {
    process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST = 'meta,google';
    expect(paidAdServiceFeeCheckoutPolicy('meta')).toEqual({
      allowed: false,
      code: 'paid_ads_provider_adapter_required',
    });
    expect(paidAdServiceFeeCheckoutPolicy('google')).toEqual({
      allowed: false,
      code: 'paid_ads_provider_adapter_required',
    });
  });
});
