import store from '../utils/store.js';

const KIND = 'paid_ad_budget';
const DEFAULT_FEE_BPS = 500; // 5%
const MIN_TOTAL_CENTS = 1000; // $10 all-in budget
const MAX_TOTAL_CENTS = 10_000_000; // $100,000 safety ceiling
const SUPPORTED_PROVIDERS = new Set(['meta', 'google']);

function clampFeeBps(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2000) return DEFAULT_FEE_BPS;
  return parsed;
}

export function getPlatformFeeBps() {
  return clampFeeBps(process.env.PAID_AD_PLATFORM_FEE_BPS ?? DEFAULT_FEE_BPS);
}

export function calculateBudgetBreakdown(totalBudgetCents, feeBps = getPlatformFeeBps()) {
  const total = Number(totalBudgetCents);
  if (!Number.isInteger(total) || total < MIN_TOTAL_CENTS || total > MAX_TOTAL_CENTS) {
    throw new Error('All-in paid advertising budget must be between $10 and $100,000.');
  }

  const normalizedFeeBps = clampFeeBps(feeBps);
  const serviceFeeCents = Math.max(50, Math.floor((total * normalizedFeeBps) / 10_000));
  const mediaSpendCapCents = total - serviceFeeCents;
  if (mediaSpendCapCents <= 0) throw new Error('Budget is too small after the service fee.');

  return {
    totalBudgetCents: total,
    serviceFeeBps: normalizedFeeBps,
    serviceFeeCents,
    mediaSpendCapCents,
  };
}

export async function listPaidAdBudgets(userId) {
  const content = await store.getContentByOwner(userId);
  return content
    .filter((item) => item.kind === KIND)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

export async function getPaidAdBudget(userId, budgetId) {
  const budgets = await listPaidAdBudgets(userId);
  return budgets.find((item) => item.id === budgetId) || null;
}

export async function createPaidAdBudget({
  userId,
  portfolioProductId = null,
  provider,
  totalBudgetCents,
  enabled = false,
}) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(normalizedProvider)) {
    throw new Error('Paid advertising provider must be Meta or Google.');
  }
  const breakdown = calculateBudgetBreakdown(totalBudgetCents);
  const now = new Date().toISOString();

  return store.createContent({
    kind: KIND,
    owner: userId,
    ownerId: userId,
    portfolioProductId: portfolioProductId || null,
    provider: normalizedProvider,
    enabled: Boolean(enabled),
    strictHardStop: true,
    status: enabled ? 'service_fee_required' : 'disabled',
    reportedMediaSpendCents: 0,
    remainingMediaBudgetCents: breakdown.mediaSpendCapCents,
    ...breakdown,
    serviceFeePaidAt: null,
    stripeFeeSessionId: null,
    providerCampaignId: null,
    pausedAt: null,
    hardStopReason: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updatePaidAdBudget(userId, budgetId, updates = {}) {
  const current = await getPaidAdBudget(userId, budgetId);
  if (!current) return null;

  const patch = { updatedAt: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(updates, 'enabled')) {
    patch.enabled = Boolean(updates.enabled);
    if (!patch.enabled) {
      patch.status = 'disabled';
      patch.pausedAt = new Date().toISOString();
      patch.hardStopReason = 'user_disabled';
    } else if (current.serviceFeePaidAt) {
      patch.status = current.providerCampaignId ? 'active' : 'ready';
      patch.pausedAt = null;
      patch.hardStopReason = null;
    } else {
      patch.status = 'service_fee_required';
      patch.pausedAt = null;
      patch.hardStopReason = null;
    }
  }

  if (updates.totalBudgetCents != null) {
    if (current.reportedMediaSpendCents > 0) {
      throw new Error('Spend limit cannot be changed after paid media spending begins. Create a new budget instead.');
    }
    const breakdown = calculateBudgetBreakdown(updates.totalBudgetCents);
    Object.assign(patch, breakdown, {
      remainingMediaBudgetCents: breakdown.mediaSpendCapCents,
      serviceFeePaidAt: null,
      stripeFeeSessionId: null,
      status: current.enabled ? 'service_fee_required' : 'disabled',
    });
  }

  return store.updateContent(current.id, patch);
}

export async function markServiceFeeCheckoutCreated(userId, budgetId, sessionId) {
  const current = await getPaidAdBudget(userId, budgetId);
  if (!current) return null;
  return store.updateContent(current.id, {
    stripeFeeSessionId: sessionId,
    status: 'service_fee_pending',
    updatedAt: new Date().toISOString(),
  });
}

export async function markServiceFeePaid({ userId, budgetId, sessionId }) {
  const current = await getPaidAdBudget(userId, budgetId);
  if (!current) return null;
  if (current.stripeFeeSessionId && sessionId && current.stripeFeeSessionId !== sessionId) return null;

  return store.updateContent(current.id, {
    serviceFeePaidAt: new Date().toISOString(),
    stripeFeeSessionId: sessionId || current.stripeFeeSessionId || null,
    status: current.enabled ? 'ready' : 'disabled',
    updatedAt: new Date().toISOString(),
  });
}

export function providerManagedBillingAvailable(provider) {
  const allow = String(process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(String(provider || '').toLowerCase());
}

export function paidAdServiceFeeCheckoutPolicy(provider) {
  const allowed = providerManagedBillingAvailable(provider);
  return {
    allowed,
    code: allowed ? null : 'paid_ads_provider_adapter_required',
  };
}

export function getManagedPaidAdProviders() {
  return [...SUPPORTED_PROVIDERS].filter(providerManagedBillingAvailable);
}

export async function activatePaidAdBudget(userId, budgetId) {
  const current = await getPaidAdBudget(userId, budgetId);
  if (!current) return { error: 'not_found' };
  if (!current.enabled) return { error: 'disabled', budget: current };
  if (!current.serviceFeePaidAt) return { error: 'service_fee_required', budget: current };
  if (current.remainingMediaBudgetCents <= 0) return { error: 'budget_exhausted', budget: current };

  // We refuse to launch live paid media unless a provider adapter has been explicitly
  // approved for managed billing + hard-stop control. This prevents fake green lights
  // and prevents the app from pretending it can guarantee a cap it cannot enforce.
  if (!providerManagedBillingAvailable(current.provider)) {
    return { error: 'provider_adapter_required', budget: current };
  }

  const activated = await store.updateContent(current.id, {
    status: 'ready_for_provider_launch',
    updatedAt: new Date().toISOString(),
  });
  return { budget: activated };
}

export async function recordProviderSpend({ userId, budgetId, spendCents, providerCampaignId = null }) {
  const current = await getPaidAdBudget(userId, budgetId);
  if (!current) return null;

  const reported = Number(spendCents);
  if (!Number.isInteger(reported) || reported < 0) throw new Error('Invalid provider spend amount.');

  const cappedSpend = Math.min(reported, current.mediaSpendCapCents);
  const remaining = Math.max(0, current.mediaSpendCapCents - cappedSpend);
  const exhausted = remaining === 0;
  return store.updateContent(current.id, {
    providerCampaignId: providerCampaignId || current.providerCampaignId || null,
    reportedMediaSpendCents: cappedSpend,
    remainingMediaBudgetCents: remaining,
    status: exhausted ? 'hard_stopped' : 'active',
    pausedAt: exhausted ? new Date().toISOString() : null,
    hardStopReason: exhausted ? 'spend_limit_reached' : null,
    updatedAt: new Date().toISOString(),
  });
}

export const paidAdvertisingLimits = {
  minTotalCents: MIN_TOTAL_CENTS,
  maxTotalCents: MAX_TOTAL_CENTS,
  providers: [...SUPPORTED_PROVIDERS],
};
