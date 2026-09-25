import store from '../utils/store.js';
import { isOwnerEmail } from '../utils/owner.js';
import { normalizeSubscriptionAccess } from './godCodeService.js';

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export async function getMarketingEntitlement(user) {
  if (!user) {
    return {
      allowed: false,
      reason: 'authentication_required',
      source: null,
      plan: null,
      subscription: null,
    };
  }

  if (isOwnerEmail(user.email)) {
    return {
      allowed: true,
      reason: 'owner',
      source: 'owner',
      plan: 'enterprise',
      subscription: {
        status: 'active',
        source: 'owner',
        plan: 'enterprise',
        unlimited: true,
        lifetimeAccess: true,
        expiresAt: null,
      },
    };
  }

  const subscriptions = await store.getSubscriptionsByUser(user.id);
  const ordered = subscriptions
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

  for (const candidate of ordered) {
    const normalized = await normalizeSubscriptionAccess(candidate);
    if (!normalized) continue;
    if (ACTIVE_STATUSES.has(normalized.status)) {
      return {
        allowed: true,
        reason: 'subscription',
        source: normalized.source || 'subscription',
        plan: normalized.plan || null,
        subscription: normalized,
      };
    }
  }

  return {
    allowed: false,
    reason: 'payment_or_god_code_required',
    source: null,
    plan: null,
    subscription: ordered[0] || null,
  };
}

export async function requireMarketingEntitlement(req, res, next) {
  const entitlement = await getMarketingEntitlement(req.user);
  req.marketingEntitlement = entitlement;
  if (!entitlement.allowed) {
    return res.status(402).json({
      error: 'Marketing access requires an active paid plan or a valid god code.',
      code: 'marketing_access_required',
      billingRequired: true,
    });
  }
  return next();
}
