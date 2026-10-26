import { DEFAULT_BUDGET } from './spendGuard.js';
import { aiMonetaryCapStatus } from './aiMonetaryCapService.js';

export function costControlStatus() {
  const monetary = aiMonetaryCapStatus();
  return {
    ai: {
      usageMeteringImplemented: true,
      planTokenQuotaImplemented: true,
      atomicReservationImplemented: true,
      monetarySpendCapImplemented: true,
      monetarySpendCapConfigured: monetary.configured,
      monetaryPricingConfigured: monetary.pricingConfigured,
      monetarySpendCapUsd: monetary.capUsd,
      monetarySpendCapConfiguredPlans: monetary.configuredPlans,
      monetarySpendCapsByPlanUsd: monetary.planCapsUsd,
      providerCostRecordedOnlyWhenConfigured: true,
      note: monetary.configured
        ? 'AI calls are token-limited and protected by atomic monthly monetary spend caps for the configured plans. Requests fail closed if required pricing is missing.'
        : 'AI monetary spend-cap enforcement is implemented but no owner-approved monthly USD cap is configured yet. Configure AI_MONTHLY_USD_CAP or a per-plan AI_MONTHLY_USD_CAP_<PLAN> during production activation.',
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
