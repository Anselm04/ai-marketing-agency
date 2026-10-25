import { getUserPlanContext } from './planQuotaService.js';
import { reserveUsageQuota, releaseQuotaReservation, settleUsageReservation } from './quotaReservationService.js';

const PROVIDER_PREFIXES = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'COHERE', 'MISTRAL', 'GROQ', 'AZURE', 'BEDROCK'];
const MARKETING_PLANS = ['starter', 'growth', 'agency', 'enterprise'];

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function configuredMonthlyAiCostCap(plan) {
  const planKey = `AI_MONTHLY_USD_CAP_${String(plan || 'starter').toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return positiveNumber(process.env[planKey] ?? process.env.AI_MONTHLY_USD_CAP);
}

function providerRates(prefix) {
  const normalized = String(prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const input = positiveNumber(process.env[`${normalized}_INPUT_USD_PER_1M`]);
  const output = positiveNumber(process.env[`${normalized}_OUTPUT_USD_PER_1M`]);
  if (input == null || output == null) return null;
  return { provider: normalized.toLowerCase(), input, output };
}

export function configuredAiPricing(provider = null) {
  if (provider) return providerRates(provider);
  const rates = PROVIDER_PREFIXES.map(providerRates).filter(Boolean);
  if (!rates.length) return null;
  return rates.reduce((mostExpensive, candidate) => {
    if (!mostExpensive) return candidate;
    return (candidate.input + candidate.output) > (mostExpensive.input + mostExpensive.output)
      ? candidate
      : mostExpensive;
  }, null);
}

export function estimateAiRequestCostUsd(messages = [], maxOutputTokens = 0, provider = null) {
  const rates = configuredAiPricing(provider);
  if (!rates) return null;
  const characters = (messages || []).reduce(
    (total, message) => total + String(message?.content || '').length,
    0,
  );
  const inputTokens = Math.max(1, Math.ceil(characters / 4));
  const outputTokens = Math.max(0, Number(maxOutputTokens) || 0);
  return ((inputTokens / 1_000_000) * rates.input) + ((outputTokens / 1_000_000) * rates.output);
}

export async function reserveMonthlyAiCostQuota({ userId, messages = [], maxOutputTokens = 0, provider = null, now = new Date() }) {
  if (!userId) return null;
  const context = await getUserPlanContext(userId);
  const capUsd = configuredMonthlyAiCostCap(context.plan);
  if (capUsd == null) {
    return { configured: false, reservation: null, capUsd: null, estimatedCostUsd: null };
  }

  const estimatedCostUsd = estimateAiRequestCostUsd(messages, maxOutputTokens, provider);
  if (estimatedCostUsd == null) {
    const error = new Error('AI monetary spend protection is configured, but complete input/output provider pricing is missing. The AI request is blocked until pricing is configured.');
    error.status = 503;
    error.statusCode = 503;
    error.code = 'ai_cost_pricing_not_configured';
    error.plan = context.plan;
    throw error;
  }

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const reservation = await reserveUsageQuota({
    userId,
    metric: 'ai_cost_usd',
    requested: Math.max(estimatedCostUsd, 0.000001),
    limit: capUsd,
    windowStart: monthStart.toISOString(),
    windowEnd: monthEnd.toISOString(),
    resource: 'monthly AI monetary spend',
  });

  return { configured: true, reservation, capUsd, estimatedCostUsd, plan: context.plan };
}

export async function settleMonthlyAiCostQuota({ monetary, userId, provider = null, model = null, operation = null, actualCostUsd = null }) {
  const reservationId = monetary?.reservation?.id;
  if (!reservationId) return null;
  const actual = Number(actualCostUsd);
  const quantity = Number.isFinite(actual) && actual >= 0
    ? actual
    : Math.max(0, Number(monetary?.estimatedCostUsd) || 0);

  return settleUsageReservation({
    id: reservationId,
    userId,
    metric: 'ai_cost_usd',
    quantity,
    provider,
    model,
    costUsd: null,
    metadata: {
      operation,
      estimatedCostUsd: monetary?.estimatedCostUsd ?? null,
      actualCostUsd: Number.isFinite(actual) && actual >= 0 ? actual : null,
      settledFromEstimate: !(Number.isFinite(actual) && actual >= 0),
    },
  });
}

export async function releaseMonthlyAiCostQuota(monetary) {
  await releaseQuotaReservation(monetary?.reservation?.id);
}

export function aiMonetaryCapStatus(plan = null) {
  if (plan) {
    const capUsd = configuredMonthlyAiCostCap(plan);
    return {
      implemented: true,
      configured: capUsd != null,
      capUsd,
      configuredPlans: capUsd != null ? [String(plan)] : [],
      planCapsUsd: { [String(plan)]: capUsd },
      pricingConfigured: Boolean(configuredAiPricing()),
    };
  }

  const planCapsUsd = Object.fromEntries(MARKETING_PLANS.map((id) => [id, configuredMonthlyAiCostCap(id)]));
  const configuredPlans = MARKETING_PLANS.filter((id) => planCapsUsd[id] != null);
  return {
    implemented: true,
    configured: configuredPlans.length > 0,
    capUsd: positiveNumber(process.env.AI_MONTHLY_USD_CAP),
    configuredPlans,
    planCapsUsd,
    pricingConfigured: Boolean(configuredAiPricing()),
  };
}

export default {
  aiMonetaryCapStatus,
  configuredAiPricing,
  configuredMonthlyAiCostCap,
  estimateAiRequestCostUsd,
  releaseMonthlyAiCostQuota,
  reserveMonthlyAiCostQuota,
  settleMonthlyAiCostQuota,
};
