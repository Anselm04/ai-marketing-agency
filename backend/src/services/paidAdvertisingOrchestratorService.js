import store from '../utils/store.js';
import {
  activatePaidAdBudget,
  getPaidAdBudget,
  recordProviderSpend,
  updatePaidAdBudget,
} from './paidAdvertisingService.js';
import {
  launchManagedPaidAdCampaign,
  pauseManagedPaidAdCampaign,
  readManagedPaidAdSpend,
} from './managedPaidAdsExecutionService.js';
import { assertAuthorizationCoversBudget } from './paidAdAuthorizationService.js';
import { applyDailySpendSnapshot, providerLocalDate } from './paidAdDailySpendService.js';

function orchestrationError(message, code, cause = null) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 502;
  if (cause) error.cause = cause;
  return error;
}

export async function activateManagedPaidAdBudget(userId, budgetId) {
  const current = await getPaidAdBudget(userId, budgetId);
  if (!current) return { error: 'not_found' };
  try {
    assertAuthorizationCoversBudget(current.spendAuthorization, current);
  } catch (error) {
    return {
      error: 'authorization_required',
      authorizationCode: error.code || 'paid_ads_authorization_required',
      budget: current,
    };
  }

  const armed = await activatePaidAdBudget(userId, budgetId);
  if (armed.error) return armed;
  const budget = armed.budget;

  try {
    const launch = await launchManagedPaidAdCampaign(userId, budget);
    const updated = await store.updateContent(budget.id, {
      providerCampaignId: launch.campaignId || null,
      providerCampaignResourceName: launch.campaignResourceName || null,
      providerBudgetResourceName: launch.budgetResourceName || null,
      providerAdSetId: launch.adSetId || null,
      providerAdGroupResourceName: launch.adGroupResourceName || null,
      providerCreativeId: launch.creativeId || null,
      providerAdId: launch.adId || null,
      providerAdResourceName: launch.adResourceName || null,
      status: 'active',
      launchedAt: new Date().toISOString(),
      providerLaunchError: null,
      updatedAt: new Date().toISOString(),
    });
    return { budget: updated, launch };
  } catch (error) {
    await store.updateContent(budget.id, {
      status: 'provider_launch_failed',
      providerLaunchError: error.code || 'paid_ads_provider_launch_failed',
      providerPartialResources: error.providerResources || null,
      updatedAt: new Date().toISOString(),
    });
    throw orchestrationError(
      'The provider did not complete campaign launch. No live-success state was recorded.',
      error.code || 'paid_ads_provider_launch_failed',
      error,
    );
  }
}

export async function disableManagedPaidAdBudget(userId, budgetId) {
  const current = await getPaidAdBudget(userId, budgetId);
  if (!current) return null;

  if (current.providerCampaignId && current.status !== 'hard_stopped') {
    try {
      await pauseManagedPaidAdCampaign(userId, current);
    } catch (error) {
      await store.updateContent(current.id, {
        status: 'provider_pause_failed',
        hardStopReason: 'provider_pause_failed',
        updatedAt: new Date().toISOString(),
      });
      throw orchestrationError(
        'The provider did not confirm the campaign pause. The campaign is not being reported as disabled.',
        error.code || 'paid_ads_provider_pause_failed',
        error,
      );
    }
  }

  return updatePaidAdBudget(userId, budgetId, { enabled: false });
}

export async function reconcileManagedPaidAdBudget(userId, budgetId) {
  const current = await getPaidAdBudget(userId, budgetId);
  if (!current) return null;
  if (!current.providerCampaignId) return current;
  if (current.status === 'daily_capped') return current;

  try {
    assertAuthorizationCoversBudget(current.spendAuthorization, current);
  } catch (error) {
    if (current.status !== 'hard_stopped') {
      try {
        await pauseManagedPaidAdCampaign(userId, current);
      } catch (pauseError) {
        await store.updateContent(current.id, {
          status: 'provider_pause_failed',
          hardStopReason: 'authorization_pause_failed',
          updatedAt: new Date().toISOString(),
        });
        throw orchestrationError(
          'Customer authorization is no longer valid and the provider did not confirm the campaign pause.',
          'paid_ads_authorization_hard_stop_failed',
          pauseError,
        );
      }
    }
    return store.updateContent(current.id, {
      enabled: false,
      status: 'hard_stopped',
      pausedAt: new Date().toISOString(),
      hardStopReason: error.code || 'paid_ads_authorization_invalid',
      updatedAt: new Date().toISOString(),
    });
  }

  const providerSpend = await readManagedPaidAdSpend(userId, current);
  const spendMinor = Math.max(0, Number(providerSpend.spendMinor) || 0);
  const authorizedCap = Math.min(
    Number(current.mediaSpendCapCents || 0),
    Number(current.spendAuthorization?.maxMediaSpendCents || 0),
  );
  const currentDate = providerLocalDate(current.providerAccount?.timezone || 'UTC');
  const daily = applyDailySpendSnapshot({
    previousProviderTotalCents: current.reportedMediaSpendCents,
    currentProviderTotalCents: spendMinor,
    previousDailySpendCents: current.dailyMediaSpendCents,
    previousDailySpendDate: current.dailySpendDate,
    currentDate,
    dailyCapCents: current.spendAuthorization?.dailyMediaSpendCapCents,
  });
  const exhausted = spendMinor >= authorizedCap;

  if (exhausted && current.status !== 'hard_stopped') {
    try {
      await pauseManagedPaidAdCampaign(userId, current);
    } catch (error) {
      await store.updateContent(current.id, {
        status: 'provider_pause_failed',
        hardStopReason: 'spend_limit_pause_failed',
        reportedMediaSpendCents: spendMinor,
        remainingMediaBudgetCents: 0,
        dailySpendDate: daily.dailySpendDate,
        dailyMediaSpendCents: daily.dailySpendCents,
        updatedAt: new Date().toISOString(),
      });
      throw orchestrationError(
        'Spend reached the customer-authorized limit but the provider did not confirm the campaign pause.',
        'paid_ads_hard_stop_failed',
        error,
      );
    }
  }

  if (!exhausted && daily.dailyCapReached) {
    try {
      await pauseManagedPaidAdCampaign(userId, current);
    } catch (error) {
      await store.updateContent(current.id, {
        status: 'provider_pause_failed',
        hardStopReason: 'daily_spend_cap_pause_failed',
        reportedMediaSpendCents: spendMinor,
        remainingMediaBudgetCents: Math.max(0, authorizedCap - spendMinor),
        dailySpendDate: daily.dailySpendDate,
        dailyMediaSpendCents: daily.dailySpendCents,
        updatedAt: new Date().toISOString(),
      });
      throw orchestrationError(
        'The customer daily spend cap was reached but the provider did not confirm the campaign pause.',
        'paid_ads_daily_cap_stop_failed',
        error,
      );
    }

    return store.updateContent(current.id, {
      reportedMediaSpendCents: spendMinor,
      remainingMediaBudgetCents: Math.max(0, authorizedCap - spendMinor),
      status: 'daily_capped',
      pausedAt: new Date().toISOString(),
      hardStopReason: 'daily_spend_cap_reached',
      dailySpendDate: daily.dailySpendDate,
      dailyMediaSpendCents: daily.dailySpendCents,
      updatedAt: new Date().toISOString(),
    });
  }

  const recorded = await recordProviderSpend({
    userId,
    budgetId,
    spendCents: spendMinor,
    providerCampaignId: current.providerCampaignId,
  });
  return store.updateContent(recorded.id, {
    dailySpendDate: daily.dailySpendDate,
    dailyMediaSpendCents: daily.dailySpendCents,
    updatedAt: new Date().toISOString(),
  });
}

export async function reconcileAllManagedPaidAdsForUser(userId) {
  const { listPaidAdBudgets } = await import('./paidAdvertisingService.js');
  const budgets = await listPaidAdBudgets(userId);
  const results = [];
  for (const budget of budgets.filter((item) => item.providerCampaignId && ['active', 'hard_stopped', 'provider_pause_failed'].includes(item.status))) {
    try {
      results.push(await reconcileManagedPaidAdBudget(userId, budget.id));
    } catch (error) {
      results.push({ id: budget.id, error: error.code || 'reconciliation_failed' });
    }
  }
  return results;
}

export default {
  activateManagedPaidAdBudget,
  disableManagedPaidAdBudget,
  reconcileManagedPaidAdBudget,
  reconcileAllManagedPaidAdsForUser,
};
