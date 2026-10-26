import { describe, expect, test } from '@jest/globals';
import { existingGodCodeSubscription } from '../godCodeService.js';
import { strongestSubscription } from '../marketingEntitlementService.js';

describe('god-code and Stripe entitlement coexistence', () => {
  test('selects only an existing god-code record for god-code updates', () => {
    const subscriptions = [
      { id: 'stripe-sub', source: 'stripe', status: 'active', plan: 'agency' },
      { id: 'god-grant', source: 'god-code', status: 'active', plan: 'growth' },
    ];

    expect(existingGodCodeSubscription(subscriptions)).toMatchObject({ id: 'god-grant', source: 'god-code' });
  });

  test('returns null when the user only has Stripe access so redemption creates a separate grant', () => {
    expect(existingGodCodeSubscription([
      { id: 'stripe-sub', source: 'stripe', status: 'active', plan: 'agency' },
    ])).toBeNull();
  });

  test('finite lifetime access does not outrank a higher paid plan', () => {
    const selected = strongestSubscription([
      {
        id: 'lifetime-growth',
        source: 'god-code',
        status: 'active',
        plan: 'growth',
        lifetimeAccess: true,
        unlimited: false,
      },
      {
        id: 'paid-agency',
        source: 'stripe',
        status: 'active',
        plan: 'agency',
        lifetimeAccess: false,
        unlimited: false,
      },
    ]);

    expect(selected).toMatchObject({ id: 'paid-agency', plan: 'agency', source: 'stripe' });
  });
});
