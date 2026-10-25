import { afterEach, describe, expect, test } from '@jest/globals';
import { costControlStatus } from '../services/costControlStatus.js';

const originalCap = process.env.AI_MONTHLY_USD_CAP;

afterEach(() => {
  if (originalCap == null) delete process.env.AI_MONTHLY_USD_CAP;
  else process.env.AI_MONTHLY_USD_CAP = originalCap;
});

describe('cost control health status', () => {
  test('distinguishes implemented AI monetary protection from owner configuration', () => {
    delete process.env.AI_MONTHLY_USD_CAP;
    const status = costControlStatus();
    expect(status.ai.usageMeteringImplemented).toBe(true);
    expect(status.ai.planTokenQuotaImplemented).toBe(true);
    expect(status.ai.atomicReservationImplemented).toBe(true);
    expect(status.ai.monetarySpendCapImplemented).toBe(true);
    expect(status.ai.monetarySpendCapConfigured).toBe(false);
    expect(status.ai.monetarySpendCapUsd).toBeNull();
  });

  test('reports an owner-configured global monthly AI cap without inventing one', () => {
    process.env.AI_MONTHLY_USD_CAP = '125.50';
    const status = costControlStatus();
    expect(status.ai.monetarySpendCapImplemented).toBe(true);
    expect(status.ai.monetarySpendCapConfigured).toBe(true);
    expect(status.ai.monetarySpendCapUsd).toBe(125.5);
  });

  test('does not claim live ad-provider spend enforcement is verified', () => {
    const status = costControlStatus();
    expect(status.advertising.internalBudgetGuardImplemented).toBe(true);
    expect(status.advertising.liveProviderSpendGuardVerified).toBe(false);
  });
});
