import { describe, expect, test } from '@jest/globals';
import { normalizePaidAdCampaignConfig } from '../paidAdvertisingService.js';

describe('paid advertising campaign configuration', () => {
  test('normalizes a real Meta traffic campaign', () => {
    const config = normalizePaidAdCampaignConfig('meta', {
      name: 'Launch traffic',
      destinationUrl: 'https://example.com/product',
      pageId: '123456789',
      primaryText: 'See the new product.',
      headline: 'Learn more',
      countries: ['nz'],
    });

    expect(config.type).toBe('meta_traffic');
    expect(config.objective).toBe('OUTCOME_TRAFFIC');
    expect(config.destinationUrl).toBe('https://example.com/product');
    expect(config.countries).toEqual(['NZ']);
  });

  test('requires complete Google Search creative inputs', () => {
    expect(() => normalizePaidAdCampaignConfig('google', {
      name: 'Search launch',
      destinationUrl: 'https://example.com',
      headlines: ['One', 'Two'],
      descriptions: ['Description one', 'Description two'],
      keywords: ['example'],
    })).toThrow(/three headlines/i);
  });

  test('rejects non-HTTPS campaign destinations', () => {
    expect(() => normalizePaidAdCampaignConfig('meta', {
      name: 'Unsafe',
      destinationUrl: 'http://example.com',
      pageId: '123',
      primaryText: 'Text',
      headline: 'Headline',
      countries: ['NZ'],
    })).toThrow(/HTTPS/i);
  });
});
