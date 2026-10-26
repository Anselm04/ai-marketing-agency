import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const reserveDailyPostQuota = jest.fn();
const recordUsage = jest.fn();
const releaseQuotaReservation = jest.fn();
const settleUsageReservation = jest.fn();
const publishWithPreferredToken = jest.fn();
const honestResult = jest.fn((result) => result);

jest.unstable_mockModule('../../services/planQuotaService.js', () => ({ reserveDailyPostQuota }));
jest.unstable_mockModule('../../services/usageMeteringService.js', () => ({ recordUsage }));
jest.unstable_mockModule('../../services/quotaReservationService.js', () => ({
  releaseQuotaReservation,
  settleUsageReservation,
}));
jest.unstable_mockModule('../socialHelpers.js', () => ({
  publishWithPreferredToken,
  honestResult,
}));

const { publishOneWithQuota } = await import('../socialPart2b.js');

beforeEach(() => {
  reserveDailyPostQuota.mockReset();
  recordUsage.mockReset();
  releaseQuotaReservation.mockReset();
  settleUsageReservation.mockReset();
  publishWithPreferredToken.mockReset();
  honestResult.mockClear();
});

describe('direct social publishing quota accounting', () => {
  test('settles one social post only after the provider confirms publication', async () => {
    reserveDailyPostQuota.mockResolvedValueOnce({ reservation: { id: 'reservation-1' } });
    publishWithPreferredToken.mockResolvedValueOnce([{ success: true, published: true, platform: 'x', postId: 'provider-post-1' }]);

    const result = await publishOneWithQuota({
      userId: 'user-1',
      platform: 'x',
      content: { caption: 'Hello' },
      metadata: { localPostId: 'local-1' },
    });

    expect(result).toMatchObject({ published: true, postId: 'provider-post-1' });
    expect(settleUsageReservation).toHaveBeenCalledWith(expect.objectContaining({
      id: 'reservation-1',
      userId: 'user-1',
      metric: 'social_posts',
      quantity: 1,
      metadata: expect.objectContaining({ platform: 'x', source: 'manual_publish', localPostId: 'local-1' }),
    }));
    expect(releaseQuotaReservation).not.toHaveBeenCalled();
  });

  test('releases the reservation when the provider does not publish', async () => {
    reserveDailyPostQuota.mockResolvedValueOnce({ reservation: { id: 'reservation-2' } });
    publishWithPreferredToken.mockResolvedValueOnce([{ success: false, published: false, platform: 'x', blocked: true }]);

    const result = await publishOneWithQuota({ userId: 'user-2', platform: 'x', content: { caption: 'Hello' } });

    expect(result.published).toBe(false);
    expect(releaseQuotaReservation).toHaveBeenCalledWith('reservation-2');
    expect(settleUsageReservation).not.toHaveBeenCalled();
  });

  test('records successful usage for unlimited/owner reservations without an id', async () => {
    reserveDailyPostQuota.mockResolvedValueOnce({ reservation: { id: null, unlimited: true } });
    publishWithPreferredToken.mockResolvedValueOnce([{ success: true, published: true, platform: 'facebook', postId: 'fb-1' }]);

    await publishOneWithQuota({ userId: 'owner-1', platform: 'facebook', content: { caption: 'Hello' } });

    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'owner-1',
      metric: 'social_posts',
      quantity: 1,
    }));
  });

  test('releases a reservation when provider execution throws', async () => {
    reserveDailyPostQuota.mockResolvedValueOnce({ reservation: { id: 'reservation-3' } });
    publishWithPreferredToken.mockRejectedValueOnce(new Error('provider down'));

    await expect(publishOneWithQuota({ userId: 'user-3', platform: 'x', content: { caption: 'Hello' } }))
      .rejects.toThrow('provider down');
    expect(releaseQuotaReservation).toHaveBeenCalledWith('reservation-3');
  });
});
