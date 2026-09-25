import store from '../utils/store.js';
import { isOwnerEmail } from '../utils/owner.js';
import { normalizeSubscriptionAccess } from './godCodeService.js';

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

  const subscriptions = typeof store.getSubscriptionsByUser === 'function'
    ? await store.getSubscriptionsByUser(user.id)
    : (await store.getSubscriptions()).filter(
        (entry) => entry.userId === user.id || entry.user === user.id,
      );

  for (const raw of subscriptions) {
    const subscription = await normalizeSubscriptionAccess(raw);
    if (
      subscription?.status === 'active'
      && subscription?.plan
      && (!subscription.expiresAt || new Date(subscription.expiresAt).getTime() > Date.now())
    ) {
      return {
        entitled: true,
        reason: subscription.source === 'god-code' ? 'god_code' : 'paid_subscription',
        source: subscription.source || 'subscription',
        subscription,
      };
    }
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
