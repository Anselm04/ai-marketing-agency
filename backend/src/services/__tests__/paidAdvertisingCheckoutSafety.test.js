import { afterEach, describe, expect, test } from '@jest/globals';
import { paidAdServiceFeeCheckoutPolicy } from '../paidAdvertisingService.js';

describe('paid advertising service-fee checkout safety', () => {
  const original = process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST;

  afterEach(() => {
    if (original == null) delete process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST;
    else process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST = original;
  });

  test('implemented provider code is still blocked until live certification is explicitly enabled', () => {
    delete process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST;
    expect(paidAdServiceFeeCheckoutPolicy('meta')).toEqual({
      allowed: false,
      code: 'paid_ads_provider_adapter_required',
    });
    expect(paidAdServiceFeeCheckoutPolicy('google')).toEqual({
      allowed: false,
      code: 'paid_ads_provider_adapter_required',
    });
  });

  test('live certification enables only the explicitly approved implemented provider', () => {
    process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST = 'meta';
    expect(paidAdServiceFeeCheckoutPolicy('meta')).toEqual({ allowed: true, code: null });
    expect(paidAdServiceFeeCheckoutPolicy('google')).toEqual({
      allowed: false,
      code: 'paid_ads_provider_adapter_required',
    });
  });

  test('unknown provider cannot be enabled by environment configuration', () => {
    process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST = 'unknown';
    expect(paidAdServiceFeeCheckoutPolicy('unknown')).toEqual({
      allowed: false,
      code: 'paid_ads_provider_adapter_required',
    });
  });
});
