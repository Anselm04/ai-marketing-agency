import { describe, it, expect } from '@jest/globals';
import AutoRecommender from '../core/ai/recommendations/AutoRecommender.js';
import UserProfiler from '../core/ai/recommendations/UserProfiler.js';
import CampaignMatcher from '../core/ai/recommendations/CampaignMatcher.js';
import BudgetAllocator from '../core/ai/recommendations/BudgetAllocator.js';
import ModelSelector from '../core/ai/recommendations/ModelSelector.js';
import PlatformFinder from '../core/ai/recommendations/PlatformFinder.js';
import TimelineEstimator from '../core/ai/recommendations/TimelineEstimator.js';

describe('AutoRecommender sub-engines', () => {
  const context = {
    product: 'SaaS tool',
    budget: 5000,
    category: 'technology',
    platforms: ['Instagram', 'TikTok', 'LinkedIn'],
    targetAudience: 'small businesses',
  };

  it('UserProfiler builds profile from context', () => {
    const profile = UserProfiler.build(context);
    expect(profile.category).toBe('technology');
    expect(profile.budget).toBe(5000);
    expect(profile.complexity).toBeDefined();
  });

  it('CampaignMatcher matches by category', () => {
    const matches = CampaignMatcher.match(context.category, context.product, context.budget, context.targetAudience);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toHaveProperty('type');
    expect(matches[0]).toHaveProperty('budget');
  });

  it('BudgetAllocator allocates correctly', () => {
    const allocation = BudgetAllocator.allocate(5000, ['Instagram', 'TikTok', 'LinkedIn']);
    expect(Object.keys(allocation)).toHaveLength(3);
    const total = Object.values(allocation).reduce((a, b) => a + b, 0);
    expect(total).toBe(5000);
  });

  it('ModelSelector selects by quality and budget', () => {
    const models = ModelSelector.select('generate', 'medium', 5000);
    expect(models.length).toBeGreaterThan(0);
    models.forEach(m => {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('provider');
      expect(m).toHaveProperty('costEstimate');
    });
  });

  it('PlatformFinder finds relevant platforms by category', () => {
    const platforms = PlatformFinder.find('technology', 'SaaS tool');
    expect(platforms.length).toBeGreaterThan(0);
  });

  it('TimelineEstimator estimates timeline', () => {
    const timeline = TimelineEstimator.estimate(5000, 'technology', 3);
    expect(timeline).toBeDefined();
    expect(timeline.totalDays).toBeGreaterThan(0);
  });
});

describe('AutoRecommender full pipeline', () => {
  it('returns complete recommendations', async () => {
    const context = {
      product: 'SaaS tool',
      budget: 5000,
      category: 'technology',
      platforms: ['Instagram', 'TikTok', 'LinkedIn'],
      targetAudience: 'small businesses',
    };

    const result = await AutoRecommender.getFullRecommendations(context);
    expect(result).toHaveProperty('userProfile');
    expect(result).toHaveProperty('campaignTypes');
    expect(result).toHaveProperty('budgetAllocation');
    expect(result).toHaveProperty('recommendedModels');
    expect(result).toHaveProperty('recommendedIntegrations');
    expect(result).toHaveProperty('timeline');
    expect(result).toHaveProperty('nextSteps');
    expect(result).toHaveProperty('priority');
    expect(result.campaignTypes.length).toBeGreaterThan(0);
    expect(result.recommendedModels.length).toBeGreaterThan(0);
    expect(result.recommendedIntegrations.length).toBeGreaterThan(0);
  });

  it('recommends next steps for no integrations', async () => {
    const result = await AutoRecommender.getNextSteps({});
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('action');
    expect(result[0]).toHaveProperty('description');
  });
});
