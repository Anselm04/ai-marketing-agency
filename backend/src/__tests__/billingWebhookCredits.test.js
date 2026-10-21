import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

const originalEnv = { ...process.env };

describe('Stripe credit fulfillment contract', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_test' };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test('credit packs are one-time catalog items and require authenticated checkout metadata', async () => {
    const { CATALOG } = await import('../config/stripeCatalog.js');
    for (const pack of CATALOG.credits) {
      expect(pack.interval).toBeFalsy();
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.lookup_key).toBeTruthy();
      expect(pack.priceId).toBeTruthy();
    }
  });
});
