import { describe, expect, test } from '@jest/globals';
import { strongestSubscription } from '../marketingEntitlementService.js';

describe('marketing entitlement selection', () => {
  test('chooses a higher paid plan over a lower active grant regardless of record order', () => {
    const selected = strongestSubscription([
      { id: 'god-starter', source: 'god-code', status: 'active', plan: 'starter', unlimited: false },
      { id: 'stripe-agency', source: 'stripe', status: 'active', plan: 'agency', unlimited: false },
    ]);
    expect(selected).toMatchObject({ id: 'stripe-agency', plan: 'agency', source: 'stripe' });
  });

  test('unlimited access takes precedence over a finite plan', () => {
    const selected = strongestSubscription([
      { id: 'stripe-enterprise', source: 'stripe', status: 'active', plan: 'enterprise', unlimited: false },
      { id: 'lifetime-growth', source: 'god-code', status: 'active', plan: 'growth', unlimited: true, lifetimeAccess: true },
    ]);
    expect(selected).toMatchObject({ id: 'lifetime-growth', unlimited: true });
  });

  test('ignores expired, canceled and past-due grants', () => {
    const selected = strongestSubscription([
      { id: 'expired', source: 'god-code', status: 'active', plan: 'enterprise', expiresAt: '2020-01-01T00:00:00.000Z' },
      { id: 'past-due', source: 'stripe', status: 'past_due', plan: 'enterprise' },
      { id: 'canceled', source: 'stripe', status: 'canceled', plan: 'enterprise' },
      { id: 'active', source: 'stripe', status: 'active', plan: 'growth' },
    ]);
    expect(selected).toMatchObject({ id: 'active', plan: 'growth' });
  });

  test('for equal finite plans prefers Stripe and then the newest Stripe grant', () => {
    const selected = strongestSubscription([
      { id: 'god-code', source: 'god-code', status: 'active', plan: 'growth', updatedAt: '2026-10-20T00:00:00.000Z' },
      { id: 'stripe-old', source: 'stripe', status: 'active', plan: 'growth', updatedAt: '2026-10-19T00:00:00.000Z' },
      { id: 'stripe-new', source: 'stripe', status: 'active', plan: 'growth', updatedAt: '2026-10-21T00:00:00.000Z' },
    ]);
    expect(selected).toMatchObject({ id: 'stripe-new', source: 'stripe', plan: 'growth' });
  });

  test('returns null when no grant is currently active', () => {
    expect(strongestSubscription([
      { source: 'stripe', status: 'past_due', plan: 'agency' },
      { source: 'god-code', status: 'expired', plan: 'enterprise' },
    ])).toBeNull();
  });
});
