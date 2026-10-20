import { describe, expect, test } from '@jest/globals';
import { costControlStatus } from '../services/costControlStatus.js';

describe('cost control health status', () => {
  test('separates implemented AI quotas from unverified dollar spend caps', () => {
    const status = costControlStatus();
    expect(status.ai.usageMeteringImplemented).toBe(true);
    expect(status.ai.planTokenQuotaImplemented).toBe(true);
    expect(status.ai.atomicReservationImplemented).toBe(true);
    expect(status.ai.monetarySpendCapImplemented).toBe(false);
  });

  test('does not claim live ad-provider spend enforcement is verified', () => {
    const status = costControlStatus();
    expect(status.advertising.internalBudgetGuardImplemented).toBe(true);
    expect(status.advertising.liveProviderSpendGuardVerified).toBe(false);
  });
});
