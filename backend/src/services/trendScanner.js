import axios from 'axios';
import { generateAgentResponse } from './aiService.js';

class TrendScanner {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 30 * 60 * 1000;
  }

  async scanTikTokTrends() {
    try {
      const res = await axios.get('https://www.tiktok.com/api/trending');
      return res.data;
    } catch {
      return {
        fallback: true,
        trends: [
          { hashtag: '#AITools', volume: '2.4M', category: 'tech' },
          { hashtag: '#MarketingTips', volume: '1.8M', category: 'business' },
          { hashtag: '#AppLaunch', volume: '890K', category: 'apps' },
        ],
      };
    }
  }

  async scanTwitterTrends() {
    return {
      fallback: true,
      trends: [
        { topic: 'AI Marketing', volume: '45K', sentiment: 'positive' },
        { topic: 'SaaS Growth', volume: '32K', sentiment: 'positive' },
      ],
    };
  }

  async scanGoogleTrends(keywords = ['AI marketing', 'app growth', 'SaaS tools']) {
    return {
      fallback: true,
      trends: keywords.map(k => ({
        keyword: k,
        interest: Math.floor(Math.random() * 100),
        change: `${Math.floor(Math.random() * 40 - 10)}%`,
      })),
    };
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
      tiktok: tiktok.fallback ? tiktok.trends : tiktok,
      twitter: twitter.fallback ? twitter.trends : twitter,
      google: google.fallback ? google.trends : google,
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  async predictTrends(niche) {
    const result = await generateAgentResponse('market-research', `Predict upcoming trends and viral opportunities in the ${niche} niche for the next 30 days.`, {});
    return result;
  }

  async suggestViralContent(brand, niche) {
    const result = await generateAgentResponse('content', `Suggest 5 viral content ideas for ${brand} in the ${niche} niche based on current trends.`, {});
    return result;
  }
}

export default new TrendScanner();
