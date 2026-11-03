const MODES = ['manual', 'bounded_auto', 'full_auto'];
const MODE_RANK = { manual: 0, bounded_auto: 1, full_auto: 2 };

export const AUTHORIZATION_VERSION = '2026-11-04';

function asMinorUnits(value, label, { allowZero = false } = {}) {
  const parsed = Number(value);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} must be a ${allowZero ? 'non-negative' : 'positive'} minor-unit integer.`);
  }
  return parsed;
}

function isoTimestamp(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return date.toISOString();
}

export function normalizeSpendAuthorization(input = {}) {
  const mode = String(input.mode || '').trim().toLowerCase();
  if (!MODES.includes(mode)) throw new Error('Paid advertising authorization mode is invalid.');

  const maxTotalBudgetCents = asMinorUnits(input.totalBudgetCents ?? input.maxTotalBudgetCents, 'Maximum total budget');
  const maxMediaSpendCents = asMinorUnits(input.mediaSpendCapCents ?? input.maxMediaSpendCents, 'Maximum media spend');
  if (maxMediaSpendCents > maxTotalBudgetCents) {
    throw new Error('Maximum media spend cannot exceed the maximum total budget.');
  }

  const dailyMediaSpendCapCents = asMinorUnits(input.dailyMediaSpendCapCents, 'Daily media spend cap');
  if (dailyMediaSpendCapCents > maxMediaSpendCents) {
    throw new Error('Daily media spend cap cannot exceed the maximum media spend.');
  }

  const currency = String(input.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Authorization currency must be a three-letter currency code.');

  const reauthMethod = String(input.reauthMethod || '').trim().toLowerCase();
  if (!['password', '2fa', 'recent_login'].includes(reauthMethod)) {
    throw new Error('A supported re-authentication method is required.');
  }

  return Object.freeze({
    version: AUTHORIZATION_VERSION,
    mode,
    maxTotalBudgetCents,
    maxMediaSpendCents,
    dailyMediaSpendCapCents,
    currency,
    confirmedAt: isoTimestamp(input.confirmedAt, 'Authorization confirmation'),
    reauthMethod,
  });
}

export function requiresFreshAuthorization(current, proposed) {
  if (!current) return true;
  if (!proposed) return false;
  const currentRank = MODE_RANK[String(current.mode || '').toLowerCase()] ?? -1;
  const proposedRank = MODE_RANK[String(proposed.mode || '').toLowerCase()] ?? -1;
  if (proposedRank > currentRank) return true;
  if (Number(proposed.maxTotalBudgetCents || 0) > Number(current.maxTotalBudgetCents || 0)) return true;
  if (Number(proposed.maxMediaSpendCents || 0) > Number(current.maxMediaSpendCents || 0)) return true;
  if (Number(proposed.dailyMediaSpendCapCents || 0) > Number(current.dailyMediaSpendCapCents || 0)) return true;
  if (String(proposed.currency || '').toUpperCase() !== String(current.currency || '').toUpperCase()) return true;
  return false;
}

export function summarizeAuthorizedCosts({
  totalBudgetCents,
  serviceFeeCents,
  mediaSpendCapCents,
  otherThirdPartyCostsCents = 0,
  currency,
}) {
  const maximumTotalExposureCents = asMinorUnits(totalBudgetCents, 'Maximum total exposure');
  const trillionAiFeeCents = asMinorUnits(serviceFeeCents, 'TrillionAI fee', { allowZero: true });
  const thirdPartyAdvertisingCapCents = asMinorUnits(mediaSpendCapCents, 'Third-party advertising cap', { allowZero: true });
  const otherCosts = asMinorUnits(otherThirdPartyCostsCents, 'Other third-party costs', { allowZero: true });
  const normalizedCurrency = String(currency || '').trim().toUpperCase();

  if (trillionAiFeeCents + thirdPartyAdvertisingCapCents + otherCosts > maximumTotalExposureCents) {
    throw new Error('Authorized cost components exceed the maximum total exposure.');
  }
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) throw new Error('Cost summary currency must be a three-letter currency code.');

  return Object.freeze({
    trillionAiFeeCents,
    thirdPartyAdvertisingCapCents,
    otherThirdPartyCostsCents: otherCosts,
    maximumTotalExposureCents,
    currency: normalizedCurrency,
  });
}

export function assertAuthorizationCoversBudget(authorization, budget) {
  if (!authorization) {
    const error = new Error('Customer spend authorization is required before paid advertising can start.');
    error.code = 'paid_ads_authorization_required';
    throw error;
  }

  if (authorization.version !== AUTHORIZATION_VERSION) {
    const error = new Error('Paid advertising authorization must be renewed before launch.');
    error.code = 'paid_ads_authorization_stale';
    throw error;
  }

  if (authorization.currency !== String(budget.currency || '').toUpperCase()
      || authorization.maxTotalBudgetCents !== Number(budget.totalBudgetCents)
      || authorization.maxMediaSpendCents !== Number(budget.mediaSpendCapCents)) {
    const error = new Error('Paid advertising settings changed after authorization. Please review and authorize the current limits again.');
    error.code = 'paid_ads_fresh_authorization_required';
    throw error;
  }

  if (Number(authorization.dailyMediaSpendCapCents) <= 0
      || Number(authorization.dailyMediaSpendCapCents) > Number(budget.mediaSpendCapCents)) {
    const error = new Error('A valid customer-approved daily media spend cap is required.');
    error.code = 'paid_ads_daily_cap_required';
    throw error;
  }

  return true;
}

export const paidAdAuthorizationModes = Object.freeze(MODES.slice());
