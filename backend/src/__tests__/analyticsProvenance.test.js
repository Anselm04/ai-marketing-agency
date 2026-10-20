import { describe, expect, test } from '@jest/globals';
import {
  aggregateCampaignPerformance,
  markManualPerformanceInput,
} from '../services/analyticsProvenanceService.js';

describe('analytics provenance', () => {
  test('manual revenue and spend do not become verified ROI', () => {
    const campaigns = [{
      revenue: 1000,
      spend: 250,
      performanceProvenance: {
        revenue: { kind: 'manual_user_entry', observedAt: '2026-10-21T00:00:00.000Z' },
        spend: { kind: 'manual_user_entry', observedAt: '2026-10-21T00:00:00.000Z' },
      },
    }];
    const result = aggregateCampaignPerformance(campaigns);
    expect(result.reported).toEqual({ revenue: 1000, spend: 250 });
    expect(result.verified.revenue).toBe(0);
    expect(result.verified.spend).toBe(0);
    expect(result.verified.roi).toBeNull();
  });

  test('provider-verified paired metrics can produce verified ROI', () => {
    const provenance = { kind: 'provider_verified', provider: 'example-provider', observedAt: '2026-10-21T00:00:00.000Z' };
    const result = aggregateCampaignPerformance([{
      revenue: 1000,
      spend: 500,
      performanceProvenance: { revenue: provenance, spend: provenance },
    }]);
    expect(result.verified.revenue).toBe(1000);
    expect(result.verified.spend).toBe(500);
    expect(result.verified.roi).toBe(1);
  });

  test('customer-entered performance is explicitly marked manual', () => {
    const provenance = markManualPerformanceInput({}, { revenue: 12, spend: 3 }, '2026-10-21T00:00:00.000Z');
    expect(provenance.revenue.kind).toBe('manual_user_entry');
    expect(provenance.spend.kind).toBe('manual_user_entry');
  });
});
