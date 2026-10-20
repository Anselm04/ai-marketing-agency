import axios from 'axios';
import { generateAgentResponse } from './openaiService.js';

const unavailable = (source, reason) => ({
  source,
  available: false,
  live: false,
  trends: [],
  reason,
  fetchedAt: new Date().toISOString(),
});

class TrendScanner {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 30 * 60 * 1000;
  }

  async scanTikTokTrends() {
    try {
      const res = await axios.get('https://www.tiktok.com/api/trending', { timeout: 8000 });
      const trends = Array.isArray(res.data) ? res.data : res.data?.trends;
      if (!Array.isArray(trends)) {
        return unavailable('tiktok', 'TikTok did not return a supported trend payload.');
      }
      return {
        source: 'tiktok',
        available: true,
        live: true,
        trends,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return unavailable('tiktok', 'Live TikTok trend data is currently unavailable.');
    }
  }

  async scanTwitterTrends() {
    return unavailable('x', 'Live X trend data is not configured. Connect an approved X data source before using this channel for research.');
  }

  async scanGoogleTrends() {
    return unavailable('google-trends', 'Live Google Trends data is not configured. Connect an approved current-data source before using this channel for research.');
  }

  async getAllTrends() {
    const cacheKey = 'all_trends';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const [tiktok, twitter, google] = await Promise.all([
      this.scanTikTokTrends(),
      this.scanTwitterTrends(),
      this.scanGoogleTrends(),
    ]);

    const result = {
      timestamp: new Date().toISOString(),
      researchIntegrity: {
        fabricatedFallbacks: false,
        note: 'Unavailable sources return no trend values. Only provider-returned data is shown as live.',
      },
      tiktok,
      twitter,
      google,
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  async predictTrends(niche) {
    return {
      available: false,
      researchBacked: false,
      niche,
      reason: 'Trend prediction is disabled until a current research source is connected. AI model memory is not treated as live market evidence.',
    };
  }

  async suggestViralContent(brand, niche) {
    const result = await generateAgentResponse(
      'content',
      `Create 5 channel-appropriate content ideas for ${brand} in the ${niche} niche. Do not claim that an idea is currently trending or will go viral unless current sourced evidence is supplied. Present these as creative hypotheses to test, not predictions.`,
      {},
    );
    return {
      ...result,
      researchBacked: false,
      currentTrendClaim: false,
      note: 'Creative ideas only; no live trend source was used.',
    };
  }
}

export default new TrendScanner();
