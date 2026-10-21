import { DEFAULT_BUDGET } from './spendGuard.js';

export function costControlStatus() {
  return {
    ai: {
      usageMeteringImplemented: true,
      planTokenQuotaImplemented: true,
      atomicReservationImplemented: true,
      monetarySpendCapImplemented: false,
      providerCostRecordedOnlyWhenConfigured: true,
      note: 'AI calls are customer-metered and plan-token-limited. Dollar-denominated AI spend caps are not implemented.',
    },
    advertising: {
      internalBudgetGuardImplemented: true,
      defaults: DEFAULT_BUDGET,
      liveProviderSpendGuardVerified: false,
      note: 'The internal paid-ad launch-record path enforces customer budget caps. Live Meta/Google spend enforcement is not externally verified.',
    },
  };
}

export default costControlStatus;
