import store from '../utils/store.js';
import { isOwnerEmail } from '../utils/owner.js';
import { normalizeSubscriptionAccess } from './godCodeService.js';

const PLAN_RANK = Object.freeze({
  starter: 1,
  growth: 2,
  agency: 3,
  enterprise: 4,
});

function activeSubscription(subscription, now = Date.now()) {
  return Boolean(
    subscription?.status === 'active'
    && subscription?.plan
    && (!subscription.expiresAt || new Date(subscription.expiresAt).getTime() > now),
  );
}

function entitlementRank(subscription = {}) {
  const unlimited = subscription.unlimited === true || subscription.lifetimeAccess === true;
  return {
    unlimited: unlimited ? 1 : 0,
    plan: PLAN_RANK[subscription.plan] || 0,
    stripe: subscription.source === 'stripe' ? 1 : 0,
    updated: new Date(subscription.updatedAt || subscription.createdAt || 0).getTime() || 0,
  };
}

export function strongestSubscription(subscriptions = []) {
  return subscriptions
    .filter(activeSubscription)
    .slice()
    .sort((a, b) => {
      const left = entitlementRank(a);
      const right = entitlementRank(b);
      if (left.unlimited !== right.unlimited) return right.unlimited - left.unlimited;
      if (left.plan !== right.plan) return right.plan - left.plan;
      if (left.stripe !== right.stripe) return right.stripe - left.stripe;
      return right.updated - left.updated;
    })[0] || null;
}

export async function getMarketingEntitlement(user) {
  if (!user) {
    return {
      entitled: false,
      reason: 'authentication_required',
      source: null,
      subscription: null,
    };
  }

  if (isOwnerEmail(user.email)) {
    return {
      entitled: true,
      reason: 'owner_access',
      source: 'owner',
      subscription: {
        plan: 'enterprise',
        status: 'active',
        source: 'owner',
        unlimited: true,
        lifetimeAccess: true,
        expiresAt: null,
      },
    };
  }

  const rawSubscriptions = typeof store.getSubscriptionsByUser === 'function'
    ? await store.getSubscriptionsByUser(user.id)
    : (await store.getSubscriptions()).filter(
        (entry) => entry.userId === user.id || entry.user === user.id,
      );

  const normalized = [];
  for (const raw of rawSubscriptions) {
    const subscription = await normalizeSubscriptionAccess(raw);
    if (subscription) normalized.push(subscription);
  }

  const subscription = strongestSubscription(normalized);
  if (subscription) {
    return {
      entitled: true,
      reason: subscription.source === 'god-code' ? 'god_code' : 'paid_subscription',
      source: subscription.source || 'subscription',
      subscription,
    };
  }

  return {
    entitled: false,
    reason: 'subscription_or_god_code_required',
    source: null,
    subscription: null,
  };
}

export async function requireMarketingEntitlement(req, res, next) {
  const entitlement = await getMarketingEntitlement(req.user);
  if (!entitlement.entitled) {
    return res.status(402).json({
      error: 'An active Marketing subscription or valid plan god code is required.',
      code: 'marketing_entitlement_required',
      billingPath: '/dashboard/billing',
    });
  }
  req.marketingEntitlement = entitlement;
  return next();
}
