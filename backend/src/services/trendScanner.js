import { generateAgentResponse } from './openaiService.js';

function unavailableSource(source, reason) {
  return {
    source,
    verified: false,
    available: false,
    trends: [],
    reason,
    checkedAt: new Date().toISOString(),
  };
}

class TrendScanner {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 30 * 60 * 1000;
  }

  async scanTikTokTrends() {
    return unavailableSource(
      'tiktok',
      'No verified TikTok trend-data provider is configured. Live TikTok trend metrics are not being claimed.',
    );
  }

  async scanTwitterTrends() {
    return unavailableSource(
      'x',
      'No verified X trend-data provider is configured. Live X trend metrics are not being claimed.',
    );
  }

  async scanGoogleTrends() {
    return unavailableSource(
      'google-trends',
      'No verified Google Trends data provider is configured. Interest scores and percentage changes are not estimated or fabricated.',
    );
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
      dataPolicy: 'Only verified external measurements may be presented as current trend data.',
      tiktok,
      twitter,
      google,
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  async predictTrends(niche) {
    const result = await generateAgentResponse(
      'market-research',
      `Generate clearly labelled hypotheses about possible upcoming themes in the ${niche} niche for the next 30 days. Do not claim these are current measured trends and do not invent traffic, volume, growth, ranking, pricing, or market-share statistics.`,
      {},
    );
    return {
      evidenceType: 'model-hypothesis',
      verifiedExternalResearch: false,
      warning: 'This is an AI hypothesis, not measured current market research.',
      result,
    };
  }

  async suggestViralContent(brand, niche) {
    const result = await generateAgentResponse(
      'content',
      `Suggest 5 content-test ideas for ${brand} in the ${niche} niche. Do not claim the ideas are based on current trends unless verified research evidence is supplied in context.`,
      {},
    );
    return {
      evidenceType: 'creative-hypothesis',
      verifiedExternalResearch: false,
      warning: 'These are ideas to test, not evidence that content will go viral.',
      result,
    };
  }
}

export default new TrendScanner();
