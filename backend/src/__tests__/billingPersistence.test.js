import { describe, test, expect } from '@jest/globals';
import {
  claimStripeWebhookEvent,
  grantUserCredits,
  releaseStripeWebhookEvent,
} from '../services/billingPersistence.js';

function createMemoryAdapter(initialUser = { id: 'user-1', profile: {} }) {
  let user = structuredClone(initialUser);
  const settings = new Map();

  return {
    isPostgres: () => false,
    async findUserById(userId) {
      return user?.id === userId ? structuredClone(user) : null;
    },
    async updateUser(userId, updates) {
      if (!user || user.id !== userId) return null;
      user = { ...user, ...structuredClone(updates), id: user.id };
      return structuredClone(user);
    },
    async getSetting(key) {
      return settings.get(key) ?? null;
    },
    async setSettings(key, value) {
      settings.set(key, structuredClone(value));
    },
    async deleteSetting(key) {
      return settings.delete(key);
    },
  };
}

describe('billing persistence', () => {
  test('adds purchased credits to the durable user profile', async () => {
    const adapter = createMemoryAdapter({ id: 'user-1', profile: { credits: 25, company: 'Acme' } });

    const result = await grantUserCredits('user-1', 100, adapter);
    const updated = await adapter.findUserById('user-1');

    expect(result.addedCredits).toBe(100);
    expect(result.credits).toBe(125);
    expect(updated.profile).toEqual({ credits: 125, company: 'Acme' });
  });

  test('rejects invalid credit grants', async () => {
    const adapter = createMemoryAdapter();

    await expect(grantUserCredits('user-1', 0, adapter)).rejects.toThrow('positive integer');
    await expect(grantUserCredits('user-1', -5, adapter)).rejects.toThrow('positive integer');
  });

  test('claims a webhook event only once and can release a failed claim', async () => {
    const adapter = createMemoryAdapter();

    await expect(claimStripeWebhookEvent('evt_123', 'checkout.session.completed', adapter)).resolves.toBe(true);
    await expect(claimStripeWebhookEvent('evt_123', 'checkout.session.completed', adapter)).resolves.toBe(false);

    await releaseStripeWebhookEvent('evt_123', adapter);
    await expect(claimStripeWebhookEvent('evt_123', 'checkout.session.completed', adapter)).resolves.toBe(true);
  });
});
