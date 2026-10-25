import store from '../utils/store.js';
import { isManagedPaidAdsAdapterImplemented } from './managedPaidAdsAdapters.js';
import { requireManagedPaidAdAccount } from './managedPaidAdsProviderService.js';

const KIND = 'paid_ad_budget';
const DEFAULT_FEE_BPS = 500; // 5%
const MIN_TOTAL_CENTS = 1000; // $10 all-in budget
const MAX_TOTAL_CENTS = 10_000_000; // $100,000 safety ceiling
const SUPPORTED_PROVIDERS = new Set(['meta', 'google']);

function serviceError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function safeText(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function requiredHttpsUrl(value) {
  const text = safeText(value, 4000);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw serviceError('Campaign destination URL must be a valid HTTPS URL.', 'paid_ads_destination_url_invalid');
  }
  if (url.protocol !== 'https:') {
    throw serviceError('Campaign destination URL must use HTTPS.', 'paid_ads_destination_url_invalid');
  }
  return url.toString();
}

function stringList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => safeText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizePaidAdCampaignConfig(provider, input) {
  if (!input || typeof input !== 'object') return null;
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const name = safeText(input.name, 160);
  const destinationUrl = requiredHttpsUrl(input.destinationUrl);
  if (!name) throw serviceError('Campaign name is required.', 'paid_ads_campaign_name_required');

  if (normalizedProvider === 'meta') {
    const pageId = safeText(input.pageId, 120);
    const primaryText = safeText(input.primaryText, 2200);
    const headline = safeText(input.headline, 255);
    const countries = stringList(input.countries, 25, 2).map((country) => country.toUpperCase());
    if (!pageId) throw serviceError('A Meta Page ID is required for managed Meta ads.', 'paid_ads_meta_page_required');
    if (!primaryText) throw serviceError('Primary ad text is required for managed Meta ads.', 'paid_ads_meta_primary_text_required');
    if (!headline) throw serviceError('An ad headline is required for managed Meta ads.', 'paid_ads_meta_headline_required');
    if (!countries.length || countries.some((country) => !/^[A-Z]{2}$/.test(country))) {
      throw serviceError('At least one two-letter target country code is required for managed Meta ads.', 'paid_ads_meta_targeting_required');
    }
    return {
      type: 'meta_traffic',
      name,
      objective: 'OUTCOME_TRAFFIC',
      destinationUrl,
      pageId,
      instagramActorId: safeText(input.instagramActorId, 120) || null,
      primaryText,
      headline,
      description: safeText(input.description, 500) || null,
      callToAction: safeText(input.callToAction, 80) || 'LEARN_MORE',
      countries,
      startTime: input.startTime ? new Date(input.startTime).toISOString() : null,
      endTime: input.endTime ? new Date(input.endTime).toISOString() : null,
    };
  }

  if (normalizedProvider === 'google') {
    const headlines = stringList(input.headlines, 15, 30);
    const descriptions = stringList(input.descriptions, 4, 90);
    const keywords = stringList(input.keywords, 100, 80);
    if (headlines.length < 3) {
      throw serviceError('Google Search ads require at least three headlines.', 'paid_ads_google_headlines_required');
    }
    if (descriptions.length < 2) {
      throw serviceError('Google Search ads require at least two descriptions.', 'paid_ads_google_descriptions_required');
    }
    if (!keywords.length) {
      throw serviceError('Google Search ads require at least one keyword.', 'paid_ads_google_keywords_required');
    }
    return {
      type: 'google_search',
      name,
      destinationUrl,
      headlines,
      descriptions,
      keywords,
      languageCode: safeText(input.languageCode, 16) || 'en',
      countryCode: safeText(input.countryCode, 2).toUpperCase() || null,
      startDate: safeText(input.startDate, 10) || null,
      endDate: safeText(input.endDate, 10) || null,
    };
  }

  throw serviceError('Paid advertising provider must be Meta or Google.', 'paid_ads_provider_invalid');
}

function campaignConfigurationReady(budget) {
  return Boolean(budget?.providerAccountId && budget?.providerAccount && budget?.campaignConfig);
}

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
  providerAccountId = null,
  campaignConfig = null,
  totalBudgetCents,
  enabled = false,
}) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(normalizedProvider)) {
    throw serviceError('Paid advertising provider must be Meta or Google.', 'paid_ads_provider_invalid');
  }
  const breakdown = calculateBudgetBreakdown(totalBudgetCents);
  const normalizedCampaign = campaignConfig ? normalizePaidAdCampaignConfig(normalizedProvider, campaignConfig) : null;
  const account = providerAccountId
    ? await requireManagedPaidAdAccount(userId, normalizedProvider, providerAccountId)
    : null;

  if (enabled && (!account || !normalizedCampaign)) {
    throw serviceError(
      'Select a real advertising account and complete the campaign configuration before enabling paid advertising.',
      'paid_ads_campaign_configuration_required',
    );
  }

  const now = new Date().toISOString();
  return store.createContent({
    kind: KIND,
    owner: userId,
    ownerId: userId,
    portfolioProductId: portfolioProductId || null,
    provider: normalizedProvider,
    providerAccountId: account?.providerAccountId || null,
    providerAccount: account || null,
    campaignConfig: normalizedCampaign,
    enabled: Boolean(enabled),
    strictHardStop: true,
    status: enabled ? 'service_fee_required' : 'disabled',
    completedPosts: 0,
    reportedMediaSpendCents: 0,
    remainingMediaBudgetCents: breakdown.mediaSpendCapCents,
    ...breakdown,
    serviceFeePaidAt: null,
    stripeFeeSessionId: null,
    providerCampaignId: null,
    providerAdSetId: null,
    providerAdGroupId: null,
    providerCreativeId: null,
    pausedAt: null,
    hardStopReason: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updatePaidAdBudget(userId, budgetId, updates = {}) {
  const current = await getPaidAdBudget(userId, budgetId);
  if (!current) return null;
  if (current.reportedMediaSpendCents > 0 && (updates.providerAccountId !== undefined || updates.campaignConfig !== undefined)) {
    throw serviceError('Advertising account and campaign configuration cannot change after media spending begins.', 'paid_ads_campaign_locked');
  }

  const patch = { updatedAt: new Date().toISOString() };
  if (updates.providerAccountId !== undefined) {
    const accountId = String(updates.providerAccountId || '').trim();
    const account = accountId ? await requireManagedPaidAdAccount(userId, current.provider, accountId) : null;
    patch.providerAccountId = account?.providerAccountId || null;
    patch.providerAccount = account || null;
  }
  if (updates.campaignConfig !== undefined) {
    patch.campaignConfig = updates.campaignConfig
      ? normalizePaidAdCampaignConfig(current.provider, updates.campaignConfig)
      : null;
  }

  const future = { ...current, ...patch };
  if (Object.prototype.hasOwnProperty.call(updates, 'enabled')) {
    patch.enabled = Boolean(updates.enabled);
    if (patch.enabled && !campaignConfigurationReady({ ...future, enabled: true })) {
      throw serviceError(
        'Select a real advertising account and complete the campaign configuration before enabling paid advertising.',
        'paid_ads_campaign_configuration_required',
      );
    }
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
  const normalized = String(provider || '').toLowerCase();
  if (!isManagedPaidAdsAdapterImplemented(normalized)) return false;

  const allow = String(process.env.PAID_AD_LIVE_PROVIDER_ALLOWLIST || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(normalized);
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
  if (!campaignConfigurationReady(current)) return { error: 'campaign_configuration_required', budget: current };
  if (!current.serviceFeePaidAt) return { error: 'service_fee_required', budget: current };
  if (current.remainingMediaBudgetCents <= 0) return { error: 'budget_exhausted', budget: current };

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
