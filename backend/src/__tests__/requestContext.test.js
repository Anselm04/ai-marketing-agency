import { describe, expect, test } from '@jest/globals';
import { getCurrentUserId, runWithRequestContext } from '../utils/requestContext.js';

describe('request usage context', () => {
  test('keeps the authenticated user id scoped to the async request', async () => {
    expect(getCurrentUserId()).toBeNull();
    await runWithRequestContext({ userId: 'customer-123' }, async () => {
      await Promise.resolve();
      expect(getCurrentUserId()).toBe('customer-123');
    });
    expect(getCurrentUserId()).toBeNull();
  });
});
