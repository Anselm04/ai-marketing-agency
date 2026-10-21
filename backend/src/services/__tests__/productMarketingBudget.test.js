import { describe, expect, test } from '@jest/globals';
import productMarketingService from '../productMarketingService.js';

describe('product marketing campaign budget', () => {
  test('preserves an explicit zero-dollar planning budget', () => {
    expect(productMarketingService.normalizeBudget(0)).toBe(0);
  });

  test('uses the default only when budget is absent', () => {
    expect(productMarketingService.normalizeBudget(undefined)).toBe(1000);
    expect(productMarketingService.normalizeBudget(null)).toBe(1000);
  });
});
