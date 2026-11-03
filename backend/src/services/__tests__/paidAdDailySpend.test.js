import { describe, expect, test } from '@jest/globals';
import {
  applyDailySpendSnapshot,
  providerLocalDate,
  shouldAutoResumeDailyCap,
} from '../paidAdDailySpendService.js';

describe('paid advertising daily spend controls', () => {
  test('tracks only the incremental provider spend for the current provider-local day', () => {
    const snapshot = applyDailySpendSnapshot({
      previousProviderTotalCents: 10_000,
      currentProviderTotalCents: 12_500,
      previousDailySpendCents: 3_000,
      previousDailySpendDate: '2026-11-04',
      currentDate: '2026-11-04',
      dailyCapCents: 8_000,
    });

    expect(snapshot.incrementCents).toBe(2_500);
    expect(snapshot.dailySpendCents).toBe(5_500);
    expect(snapshot.dailyCapReached).toBe(false);
  });

  test('starts a fresh daily counter when the provider-local date changes', () => {
    const snapshot = applyDailySpendSnapshot({
      previousProviderTotalCents: 12_500,
      currentProviderTotalCents: 13_500,
      previousDailySpendCents: 8_000,
      previousDailySpendDate: '2026-11-03',
      currentDate: '2026-11-04',
      dailyCapCents: 5_000,
    });

    expect(snapshot.incrementCents).toBe(1_000);
    expect(snapshot.dailySpendCents).toBe(1_000);
    expect(snapshot.dailyCapReached).toBe(false);
  });

  test('marks the daily cap reached at or above the customer limit', () => {
    const snapshot = applyDailySpendSnapshot({
      previousProviderTotalCents: 10_000,
      currentProviderTotalCents: 15_000,
      previousDailySpendCents: 5_000,
      previousDailySpendDate: '2026-11-04',
      currentDate: '2026-11-04',
      dailyCapCents: 10_000,
    });

    expect(snapshot.dailySpendCents).toBe(10_000);
    expect(snapshot.dailyCapReached).toBe(true);
  });

  test('automatic modes may resume on a later day but manual mode may not', () => {
    const base = {
      status: 'daily_capped',
      enabled: true,
      hardStopReason: 'daily_spend_cap_reached',
      dailySpendDate: '2026-11-03',
      remainingMediaBudgetCents: 50_000,
    };

    expect(shouldAutoResumeDailyCap({ ...base, spendAuthorization: { mode: 'bounded_auto' } }, '2026-11-04')).toBe(true);
    expect(shouldAutoResumeDailyCap({ ...base, spendAuthorization: { mode: 'full_auto' } }, '2026-11-04')).toBe(true);
    expect(shouldAutoResumeDailyCap({ ...base, spendAuthorization: { mode: 'manual' } }, '2026-11-04')).toBe(false);
  });

  test('provider local date uses the account timezone and has a safe UTC fallback', () => {
    const now = new Date('2026-11-03T12:30:00.000Z');
    expect(providerLocalDate('Pacific/Auckland', now)).toBe('2026-11-04');
    expect(providerLocalDate('Invalid/Timezone', now)).toBe('2026-11-03');
  });
});
