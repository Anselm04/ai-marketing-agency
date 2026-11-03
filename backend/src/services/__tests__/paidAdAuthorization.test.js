import { describe, expect, test } from '@jest/globals';
import {
  AUTHORIZATION_VERSION,
  normalizeSpendAuthorization,
  requiresFreshAuthorization,
  summarizeAuthorizedCosts,
} from '../paidAdAuthorizationService.js';

describe('customer-authorized paid advertising controls', () => {
  test('normalizes bounded automation with an explicit daily cap', () => {
    const authorization = normalizeSpendAuthorization({
      mode: 'bounded_auto',
      totalBudgetCents: 100_000,
      mediaSpendCapCents: 95_000,
      dailyMediaSpendCapCents: 10_000,
      currency: 'NZD',
      confirmedAt: '2026-11-04T00:00:00.000Z',
      reauthMethod: 'password',
    });

    expect(authorization.version).toBe(AUTHORIZATION_VERSION);
    expect(authorization.mode).toBe('bounded_auto');
    expect(authorization.dailyMediaSpendCapCents).toBe(10_000);
    expect(authorization.maxMediaSpendCents).toBe(95_000);
    expect(authorization.currency).toBe('NZD');
    expect(authorization.reauthMethod).toBe('password');
  });

  test('fully automated mode still requires a finite customer-approved cap', () => {
    expect(() => normalizeSpendAuthorization({
      mode: 'full_auto',
      totalBudgetCents: 100_000,
      mediaSpendCapCents: 95_000,
      dailyMediaSpendCapCents: null,
      currency: 'NZD',
      confirmedAt: '2026-11-04T00:00:00.000Z',
      reauthMethod: 'password',
    })).toThrow(/daily/i);
  });

  test('increasing spend or automation authority always requires fresh authorization', () => {
    const current = {
      version: AUTHORIZATION_VERSION,
      mode: 'manual',
      maxTotalBudgetCents: 100_000,
      maxMediaSpendCents: 95_000,
      dailyMediaSpendCapCents: 10_000,
      currency: 'NZD',
    };

    expect(requiresFreshAuthorization(current, { ...current, mode: 'bounded_auto' })).toBe(true);
    expect(requiresFreshAuthorization(current, { ...current, maxTotalBudgetCents: 120_000 })).toBe(true);
    expect(requiresFreshAuthorization(current, { ...current, dailyMediaSpendCapCents: 12_000 })).toBe(true);
    expect(requiresFreshAuthorization(current, { ...current, maxTotalBudgetCents: 90_000 })).toBe(false);
  });

  test('cost summary separates TrillionAI fee from third-party advertising spend', () => {
    const summary = summarizeAuthorizedCosts({
      totalBudgetCents: 100_000,
      serviceFeeCents: 5_000,
      mediaSpendCapCents: 95_000,
      otherThirdPartyCostsCents: 0,
      currency: 'NZD',
    });

    expect(summary.trillionAiFeeCents).toBe(5_000);
    expect(summary.thirdPartyAdvertisingCapCents).toBe(95_000);
    expect(summary.otherThirdPartyCostsCents).toBe(0);
    expect(summary.maximumTotalExposureCents).toBe(100_000);
    expect(summary.currency).toBe('NZD');
  });
});
