import { describe, expect, test } from '@jest/globals';
import { stripeSubscriptionGrant } from '../routes/billing.js';

describe('Stripe subscription lifecycle sync', () => {
  test('builds an active local entitlement from Stripe subscription metadata', () => {
    const grant = stripeSubscriptionGrant({
      id: 'sub_123',
      status: 'active',
      customer: 'cus_123',
      cancel_at_period_end: false,
      current_period_end: 1799000000,
      canceled_at: null,
      ended_at: null,
      metadata: {
        marketingUserId: 'user-123',
        itemId: 'starter',
        lookup_key: 'marketing_starter_monthly',
      },
      items: { data: [{ price: { id: 'price_1UB3YfKFfiU4ONpqJ3oZyeSc' } }] },
    });

    expect(grant).toEqual(expect.objectContaining({
      userId: 'user-123',
      user: 'user-123',
      plan: 'starter',
      status: 'active',
      source: 'stripe',
      stripeSubscriptionId: 'sub_123',
      stripeCustomerId: 'cus_123',
      lookup_key: 'marketing_starter_monthly',
    }));
  });

  test('does not grant active access for a past-due subscription', () => {
    const grant = stripeSubscriptionGrant({
      id: 'sub_past_due',
      status: 'past_due',
      customer: 'cus_123',
      cancel_at_period_end: false,
      metadata: { marketingUserId: 'user-123', itemId: 'starter' },
      items: { data: [{ price: { id: 'price_1UB3YfKFfiU4ONpqJ3oZyeSc' } }] },
    });
    expect(grant.status).toBe('past_due');
  });

  test('returns null when the subscription cannot be correlated to a Marketing user and plan', () => {
    expect(stripeSubscriptionGrant({ id: 'sub_unknown', status: 'active', metadata: {}, items: { data: [] } })).toBeNull();
  });
});
