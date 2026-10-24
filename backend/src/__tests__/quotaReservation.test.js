import { beforeEach, describe, expect, test } from '@jest/globals';
import {
  releaseQuotaReservation,
  reserveUsageQuota,
  resetQuotaReservationsForTests,
  settleUsageReservation,
} from '../services/quotaReservationService.js';
import { resetMemoryUsageForTests } from '../services/usageMeteringService.js';

describe('quota reservations', () => {
  beforeEach(() => {
    resetQuotaReservationsForTests();
    resetMemoryUsageForTests();
  });

  test('rejects a second concurrent reservation beyond the remaining limit', async () => {
    const base = {
      userId: 'user-a',
      metric: 'ai_tokens',
      requested: 80,
      limit: 100,
      windowStart: '2026-10-01T00:00:00.000Z',
      windowEnd: '2026-11-01T00:00:00.000Z',
      resource: 'monthly AI usage',
    };

    const first = await reserveUsageQuota(base);
    await expect(reserveUsageQuota(base)).rejects.toMatchObject({ code: 'plan_quota_exceeded' });
    await releaseQuotaReservation(first.id);
  });

  test('settled usage remains counted after the reservation is released', async () => {
    const base = {
      userId: 'user-a',
      metric: 'social_posts',
      requested: 1,
      limit: 1,
      windowStart: '2026-10-21T00:00:00.000Z',
      windowEnd: '2026-10-22T00:00:00.000Z',
      resource: 'daily social posts',
    };

    const first = await reserveUsageQuota(base);
    await settleUsageReservation({ id: first.id, userId: 'user-a', metric: 'social_posts', quantity: 1, createdAt: '2026-10-21T12:00:00.000Z' });
    await expect(reserveUsageQuota(base)).rejects.toMatchObject({ code: 'plan_quota_exceeded' });
  });
});

