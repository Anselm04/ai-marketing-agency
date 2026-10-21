import { describe, expect, test } from '@jest/globals';
import clippingAgencyService, {
  MIN_VERIFIED_OBSERVATIONS,
  MIN_VERIFIED_VIEWS,
  verifiedPerformanceRows,
} from '../services/clippingAgencyService.js';

describe('clipping optimisation evidence', () => {
  test('manual metrics are excluded from verified evidence', () => {
    const rows = [{
      views: 1000,
      clicks: 100,
      provenance: { kind: 'manual_user_entry', observedAt: '2026-10-21T00:00:00.000Z' },
    }];
    expect(verifiedPerformanceRows(rows)).toEqual([]);
  });

  test('does not optimize tiny or unverified samples', async () => {
    const result = await clippingAgencyService.optimize([
      { views: 10000, clicks: 1000, provenance: { kind: 'manual_user_entry', observedAt: '2026-10-21T00:00:00.000Z' } },
    ], { name: 'Campaign', budget: 100 });

    expect(result.status).toBe('insufficient_verified_data');
    expect(result.recommendations).toBeNull();
    expect(result.minimumVerifiedObservations).toBe(MIN_VERIFIED_OBSERVATIONS);
    expect(result.minimumVerifiedViews).toBe(MIN_VERIFIED_VIEWS);
  });
});
