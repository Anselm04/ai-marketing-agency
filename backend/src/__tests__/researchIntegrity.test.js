import { describe, test, expect } from '@jest/globals';
import trendScanner, { requireRealHypothesis } from '../services/trendScanner.js';

describe('trend research integrity', () => {
  test('failed providers are returned as unavailable rather than fabricated trend metrics', async () => {
    const originalTikTok = trendScanner.scanTikTokTrends;
    const originalTwitter = trendScanner.scanTwitterTrends;
    const originalGoogle = trendScanner.scanGoogleTrends;

    trendScanner.scanTikTokTrends = async () => ({ verified: false, available: false, source: 'tiktok', trends: [] });
    trendScanner.scanTwitterTrends = async () => ({ verified: false, available: false, source: 'x', trends: [] });
    trendScanner.scanGoogleTrends = async () => ({ verified: false, available: false, source: 'google-trends', trends: [] });

    try {
      trendScanner.cache.clear();
      const result = await trendScanner.getAllTrends();
      expect(result.tiktok).toEqual(expect.objectContaining({ verified: false, available: false, trends: [] }));
      expect(result.twitter).toEqual(expect.objectContaining({ verified: false, available: false, trends: [] }));
      expect(result.google).toEqual(expect.objectContaining({ verified: false, available: false, trends: [] }));
      expect(JSON.stringify(result)).not.toMatch(/2\.4M|1\.8M|45K|32K/);
    } finally {
      trendScanner.scanTikTokTrends = originalTikTok;
      trendScanner.scanTwitterTrends = originalTwitter;
      trendScanner.scanGoogleTrends = originalGoogle;
      trendScanner.cache.clear();
    }
  });

  test('AI fallback text cannot be returned as a trend hypothesis', () => {
    expect(() => requireRealHypothesis({
      fallback: true,
      content: '[AI offline] market-research would invent a prediction',
    }, 'trend')).toThrow(/could not generate/i);
  });

  test('only real non-empty AI output can become a labelled hypothesis', () => {
    expect(requireRealHypothesis({ fallback: false, content: 'Hypothesis: tutorial demand may increase.' }, 'trend'))
      .toBe('Hypothesis: tutorial demand may increase.');
  });
});
