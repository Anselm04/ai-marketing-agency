import { describe, expect, test } from '@jest/globals';
import { normalizePaidAdCampaignConfig } from '../paidAdvertisingService.js';

describe('paid advertising campaign configuration', () => {
  test('normalizes a real Meta traffic campaign with schedule and compliance declaration', () => {
    const config = normalizePaidAdCampaignConfig('meta', {
      name: 'Launch traffic',
      destinationUrl: 'https://example.com/product',
      imageUrl: 'https://example.com/ad.jpg',
      pageId: '123456789',
      primaryText: 'See the new product.',
      headline: 'Learn more',
      countries: ['nz'],
      startTime: '2026-11-01T00:00:00Z',
      endTime: '2026-11-08T00:00:00Z',
      specialAdCategoriesDeclared: true,
      specialAdCategories: [],
    });

    expect(config.type).toBe('meta_traffic');
    expect(config.objective).toBe('OUTCOME_TRAFFIC');
    expect(config.destinationUrl).toBe('https://example.com/product');
    expect(config.imageUrl).toBe('https://example.com/ad.jpg');
    expect(config.countries).toEqual(['NZ']);
    expect(config.specialAdCategoriesDeclared).toBe(true);
  });

  test('requires complete Google Search creative inputs', () => {
    expect(() => normalizePaidAdCampaignConfig('google', {
      name: 'Search launch',
      destinationUrl: 'https://example.com',
      headlines: ['One', 'Two'],
      descriptions: ['Description one', 'Description two'],
      keywords: ['example'],
      countryCode: 'NZ',
      startDate: '2026-11-01',
      endDate: '2026-11-08',
      euPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    })).toThrow(/three headlines/i);
  });

  test('requires explicit Google EU political advertising declaration', () => {
    expect(() => normalizePaidAdCampaignConfig('google', {
      name: 'Search launch',
      destinationUrl: 'https://example.com',
      headlines: ['One', 'Two', 'Three'],
      descriptions: ['Description one', 'Description two'],
      keywords: ['example'],
      countryCode: 'NZ',
      startDate: '2026-11-01',
      endDate: '2026-11-08',
    })).toThrow(/political-advertising status/i);
  });

  test('requires explicit Meta special-ad-category declaration', () => {
    expect(() => normalizePaidAdCampaignConfig('meta', {
      name: 'Launch traffic',
      destinationUrl: 'https://example.com/product',
      imageUrl: 'https://example.com/ad.jpg',
      pageId: '123456789',
      primaryText: 'See the new product.',
      headline: 'Learn more',
      countries: ['NZ'],
      startTime: '2026-11-01T00:00:00Z',
      endTime: '2026-11-08T00:00:00Z',
    })).toThrow(/special-ad-category status/i);
  });

  test('rejects non-HTTPS campaign destinations', () => {
    expect(() => normalizePaidAdCampaignConfig('meta', {
      name: 'Unsafe',
      destinationUrl: 'http://example.com',
      imageUrl: 'https://example.com/ad.jpg',
      pageId: '123',
      primaryText: 'Text',
      headline: 'Headline',
      countries: ['NZ'],
      startTime: '2026-11-01T00:00:00Z',
      endTime: '2026-11-08T00:00:00Z',
      specialAdCategoriesDeclared: true,
      specialAdCategories: [],
    })).toThrow(/HTTPS/i);
  });
});
