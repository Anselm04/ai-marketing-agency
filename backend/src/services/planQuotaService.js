import store from '../utils/store.js';
import { CATALOG } from '../config/stripeCatalog.js';
import { getMarketingEntitlement } from './marketingEntitlementService.js';
import { sumUsage } from './usageMeteringService.js';

const AI_TOKEN_LIMITS = Object.freeze({
  starter: 1_000_000,
  growth: 5_000_000,
  agency: 15_000_000,
  enterprise: 50_000_000,
});

export const PLAN_LIMITS = Object.freeze(Object.fromEntries(
  CATALOG.plans.map((plan) => [
    plan.id,
    Object.freeze({
      agents: plan.features.agents,
      campaigns: plan.features.campaigns,
      postsPerDay: plan.features.postsPerDay,
      teamSeats: plan.features.teamSeats,
      monthlyAiTokens: AI_TOKEN_LIMITS[plan.id],
    }),
  ]),
));

export function getPlanLimits(plan, unlimited = false) {
  if (unlimited) {
    return {
      agents: Infinity,
      campaigns: Infinity,
      postsPerDay: Infinity,
      teamSeats: Infinity,
      monthlyAiTokens: Infinity,
    };
  }
  return PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
}

export function getAccessibleAgents(agents = [], limits = PLAN_LIMITS.starter) {
  if (limits?.agents === Infinity) return agents;
  return agents.slice(0, Math.max(0, Number(limits?.agents) || 0));
}

export function checkQuota({ used = 0, requested = 1, limit }) {
  const normalizedUsed = Math.max(0, Number(used) || 0);
  const normalizedRequested = Math.max(0, Number(requested) || 0);
  if (limit === Infinity) {
    return { allowed: true, used: normalizedUsed, requested: normalizedRequested, limit, remaining: Infinity };
  }
  const numericLimit = Math.max(0, Number(limit) || 0);
  const remaining = Math.max(0, numericLimit - normalizedUsed);
  return {
    allowed: normalizedUsed + normalizedRequested <= numericLimit,
    used: normalizedUsed,
    requested: normalizedRequested,
    limit: numericLimit,
    remaining,
  };
}

export async function getUserPlanContext(userId) {
  const user = await store.findUserById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404, code: 'user_not_found' });
  const entitlement = await getMarketingEntitlement(user);
  if (!entitlement.entitled) {
    throw Object.assign(new Error('An active Marketing subscription is required.'), {
      status: 402,
      code: 'marketing_entitlement_required',
    });
  }
  const plan = entitlement.subscription?.plan || 'starter';
  const unlimited = Boolean(entitlement.subscription?.unlimited || entitlement.source === 'owner');
  return { user, entitlement, plan, unlimited, limits: getPlanLimits(plan, unlimited) };
}

function quotaError(resource, result, plan) {
  return Object.assign(
    new Error(`${resource} limit reached for the ${plan} plan. Upgrade before creating more.`),
    {
      status: 402,
      code: 'plan_quota_exceeded',
      resource,
      plan,
      quota: result,
    },
  );
}

export async function assertCampaignQuota(userId, requested = 1) {
  const context = await getUserPlanContext(userId);
  const campaigns = await store.getCampaignsByOwner(userId);
  const active = campaigns.filter((campaign) => !['completed', 'archived', 'cancelled', 'canceled'].includes(campaign.status)).length;
  const result = checkQuota({ used: active, requested, limit: context.limits.campaigns });
  if (!result.allowed) throw quotaError('campaigns', result, context.plan);
  return { ...context, quota: result };
}

export async function assertTeamSeatQuota(ownerUserId, currentMembers, pendingInvites = 0, requested = 1) {
  const context = await getUserPlanContext(ownerUserId);
  const used = Math.max(0, Number(currentMembers) || 0) + Math.max(0, Number(pendingInvites) || 0);
  const result = checkQuota({ used, requested, limit: context.limits.teamSeats });
  if (!result.allowed) throw quotaError('team seats', result, context.plan);
  return { ...context, quota: result };
}

export async function assertDailyPostQuota(userId, requested = 1, now = new Date()) {
  const context = await getUserPlanContext(userId);
  if (context.unlimited) return { ...context, quota: checkQuota({ used: 0, requested, limit: Infinity }) };
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const used = await sumUsage({ userId, metric: 'social_posts', since: dayStart.toISOString(), until: now.toISOString() });
  const result = checkQuota({ used, requested, limit: context.limits.postsPerDay });
  if (!result.allowed) throw quotaError('daily social posts', result, context.plan);
  return { ...context, quota: result };
}

export async function assertMonthlyAiTokenQuota(userId, requested = 1, now = new Date()) {
  const context = await getUserPlanContext(userId);
  if (context.unlimited) return { ...context, quota: checkQuota({ used: 0, requested, limit: Infinity }) };
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const used = await sumUsage({ userId, metric: 'ai_tokens', since: monthStart.toISOString(), until: now.toISOString() });
  const result = checkQuota({ used, requested, limit: context.limits.monthlyAiTokens });
  if (!result.allowed) throw quotaError('monthly AI usage', result, context.plan);
  return { ...context, quota: result };
}
