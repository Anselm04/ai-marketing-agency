import { describe, expect, test } from '@jest/globals';
import { selectStripeRecord, stripeSubscriptionGrant } from '../routes/billing.js';

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

  test('never selects a god-code or other non-Stripe grant for Stripe mutation', () => {
    const records = [
      { id: 'god-1', source: 'god-code', status: 'active', plan: 'enterprise', lifetimeAccess: true },
      { id: 'manual-1', source: 'manual', status: 'active', plan: 'growth' },
      { id: 'stripe-1', source: 'stripe', status: 'active', plan: 'starter', stripeSubscriptionId: 'sub_real' },
    ];

    expect(selectStripeRecord(records)).toMatchObject({ id: 'stripe-1', stripeSubscriptionId: 'sub_real' });
    expect(selectStripeRecord(records, { subscriptionId: 'sub_real' })).toMatchObject({ id: 'stripe-1' });
  });

  test('returns no Stripe record when the user only has non-Stripe access grants', () => {
    expect(selectStripeRecord([
      { id: 'god-1', source: 'god-code', status: 'active', plan: 'enterprise' },
      { id: 'manual-1', source: 'manual', status: 'active', plan: 'growth' },
    ])).toBeNull();
  });

  test('prefers the exact Stripe subscription id over another active Stripe record', () => {
    const records = [
      { id: 'stripe-old', source: 'stripe', status: 'active', stripeSubscriptionId: 'sub_old', updatedAt: '2026-10-26T10:00:00Z' },
      { id: 'stripe-new', source: 'stripe', status: 'active', stripeSubscriptionId: 'sub_new', updatedAt: '2026-10-25T10:00:00Z' },
    ];

    expect(selectStripeRecord(records, { subscriptionId: 'sub_new' })).toMatchObject({ id: 'stripe-new' });
  });
});
