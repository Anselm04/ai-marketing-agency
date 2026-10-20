import { describe, test, expect } from '@jest/globals';
import { searchOwnedEntities } from '../services/productionSearchService.js';

describe('production search', () => {
  test('awaits asynchronous stores and isolates customer-owned records', async () => {
    const adapter = {
      getCampaignsByOwner: async () => [
        { id: 'c1', owner: 'user-1', name: 'Local plumbing leads', description: 'Palmerston North' },
      ],
      getContentByOwner: async () => [
        { id: 'p1', owner: 'user-1', title: 'Plumbing offer', body: 'Emergency callout' },
      ],
      getLeadsByOwner: async () => [
        { id: 'l1', owner: 'user-1', firstName: 'Sam', lastName: 'Customer', email: 'sam@example.com' },
      ],
      getAgents: async () => [
        { id: 'a1', name: 'Market Research', role: 'research' },
      ],
    };

    const result = await searchOwnedEntities({ adapter, ownerId: 'user-1', query: 'plumb' });

    expect(result.map((item) => item.id)).toEqual(['c1', 'p1']);
    expect(result.every((item) => item.owner !== 'user-2')).toBe(true);
  });
});
