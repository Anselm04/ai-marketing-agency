import { describe, expect, jest, test } from '@jest/globals';
import { createBusinessWorkspaceService } from '../services/businessWorkspaceService.js';

describe('business workspace service', () => {
  test('only resolves a business owned by the authenticated customer', async () => {
    const store = {
      getBusinessById: jest.fn().mockResolvedValue({ id: 'biz-1', ownerId: 'owner-a', name: 'Client A' }),
    };
    const service = createBusinessWorkspaceService(store);

    await expect(service.requireOwnedBusiness('owner-a', 'biz-1')).resolves.toMatchObject({ id: 'biz-1' });
    await expect(service.requireOwnedBusiness('owner-b', 'biz-1')).rejects.toMatchObject({ status: 404, code: 'business_not_found' });
  });

  test('sanitizes business fields and binds ownership server-side', async () => {
    const store = {
      createBusiness: jest.fn(async (payload) => ({ id: 'biz-2', ...payload })),
    };
    const service = createBusinessWorkspaceService(store);
    const created = await service.createBusiness('owner-a', {
      name: '  Client B  ',
      industry: ' SaaS ',
      owner: 'attacker',
      ownerId: 'attacker',
      targetAudience: 'Founders',
    });

    expect(store.createBusiness).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-a',
      name: 'Client B',
      industry: 'SaaS',
      targetAudience: 'Founders',
    }));
    expect(created.ownerId).toBe('owner-a');
  });

  test('filters campaigns and leads by business id without changing tenant owner boundary', () => {
    const service = createBusinessWorkspaceService({});
    const rows = [
      { id: 'a', businessId: 'biz-1' },
      { id: 'b', businessId: 'biz-2' },
      { id: 'legacy' },
    ];
    expect(service.filterByBusiness(rows, 'biz-1').map((row) => row.id)).toEqual(['a']);
    expect(service.filterByBusiness(rows, null).map((row) => row.id)).toEqual(['a', 'b', 'legacy']);
  });
});
