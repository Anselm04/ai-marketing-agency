
import store from '../utils/store.js';

const DEFAULT_WEIGHTS = {
  views: 0.05,
  likes: 1,
  comments: 2,
  shares: 3,
  clicks: 4,
  conversions: 8,
  watchTimeSeconds: 0.02,
};

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function scoreMetrics(metrics = {}) {
  return Object.entries(DEFAULT_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + number(metrics[key]) * weight,
    0,
  );
}

function hourLabel(hour) {
  const start = String(hour).padStart(2, '0') + ':00';
  const end = String((hour + 1) % 24).padStart(2, '0') + ':00';
  return start + '–' + end;
}

function combinationKey(run) {
  const assets = (run.sourceAssetIds || []).map(String).sort().join(',');
  return [
    run.aspectRatio || '9:16',
    run.assetsPerPost || run.sourceAssetIds?.length || 0,
    assets,
  ].join('|');
}

class AutoPostingAnalyticsService {
  async recordMetrics({ owner, planId, runId, platformId, metrics = {}, observedAt }) {
    const records = await store.getContentByOwner(owner);
    const plan = records.find(
      (item) => item.kind === 'auto_post_plan'
        && String(item.id) === String(planId)
        && item.owner === owner,
    );
    if (!plan) throw new Error('Auto-posting plan not found');

    const run = (plan.recentRuns || []).find((item) => String(item.id) === String(runId));
    if (!run) throw new Error('Auto-posting run not found');

    const normalized = {
      views: number(metrics.views),
      likes: number(metrics.likes),
      comments: number(metrics.comments),
      shares: number(metrics.shares),
      clicks: number(metrics.clicks),
      conversions: number(metrics.conversions),
      watchTimeSeconds: number(metrics.watchTimeSeconds),
    };
    const score = scoreMetrics(normalized);

    const platform = String(platformId || 'unknown').toLowerCase();
    const existing = records.find(
      (item) => item.kind === 'auto_post_metric'
        && item.owner === owner
        && String(item.planId) === String(planId)
        && String(item.runId) === String(runId)
        && item.platformId === platform,
    );

    const payload = {
      owner,
      planId: String(planId),
      runId: String(runId),
      platformId: platform,
      scheduledLocalHour: Number(run.scheduledLocalHour),
      actualLocalHour: Number(run.actualLocalHour),
      timezone: run.timezone || plan.timezone || 'UTC',
      sourceAssetIds: run.sourceAssetIds || [],
      aspectRatio: run.aspectRatio || plan.aspectRatio || '9:16',
      assetsPerPost: run.assetsPerPost || run.sourceAssetIds?.length || 0,
      metrics: normalized,
      performanceScore: score,
      observedAt: observedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existing) return store.updateContent(existing.id, payload);

    return store.createContent({
      kind: 'auto_post_metric',
      ...payload,
      createdAt: new Date().toISOString(),
    });
  }

  async getPlanAnalytics(owner, planId) {
    const all = await store.getContentByOwner(owner);
    const plan = all.find(
      (item) => item.kind === 'auto_post_plan'
        && String(item.id) === String(planId)
        && item.owner === owner,
    );
    if (!plan) throw new Error('Auto-posting plan not found');

    const metrics = all.filter(
      (item) => item.kind === 'auto_post_metric'
        && item.owner === owner
        && String(item.planId) === String(planId),
    );

    const byHour = new Map();
    const byCombination = new Map();

    for (const item of metrics) {
      const hour = Number.isInteger(item.actualLocalHour) ? item.actualLocalHour : item.scheduledLocalHour;
      if (Number.isInteger(hour)) {
        const bucket = byHour.get(hour) || { hour, samples: 0, score: 0, views: 0, clicks: 0, conversions: 0 };
        bucket.samples += 1;
        bucket.score += number(item.performanceScore);
        bucket.views += number(item.metrics?.views);
        bucket.clicks += number(item.metrics?.clicks);
        bucket.conversions += number(item.metrics?.conversions);
        byHour.set(hour, bucket);
      }

      const key = combinationKey(item);
      const combo = byCombination.get(key) || {
        key,
        samples: 0,
        score: 0,
        aspectRatio: item.aspectRatio,
        assetsPerPost: item.assetsPerPost,
        sourceAssetIds: item.sourceAssetIds || [],
      };
      combo.samples += 1;
      combo.score += number(item.performanceScore);
      byCombination.set(key, combo);
    }

    const hourlyPerformance = [...byHour.values()]
      .map((bucket) => ({
        ...bucket,
        averageScore: bucket.samples ? Number((bucket.score / bucket.samples).toFixed(2)) : 0,
        label: hourLabel(bucket.hour),
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    const contentCombinations = [...byCombination.values()]
      .map((combo) => ({
        ...combo,
        averageScore: combo.samples ? Number((combo.score / combo.samples).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    const totals = metrics.reduce((acc, item) => {
      acc.samples += 1;
      acc.views += number(item.metrics?.views);
      acc.likes += number(item.metrics?.likes);
      acc.comments += number(item.metrics?.comments);
      acc.shares += number(item.metrics?.shares);
      acc.clicks += number(item.metrics?.clicks);
      acc.conversions += number(item.metrics?.conversions);
      acc.watchTimeSeconds += number(item.metrics?.watchTimeSeconds);
      acc.score += number(item.performanceScore);
      return acc;
    }, {
      samples: 0,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      conversions: 0,
      watchTimeSeconds: 0,
      score: 0,
    });

    return {
      planId: String(planId),
      timezone: plan.timezone || 'UTC',
      preferredWindow: {
        startHour: plan.postingWindowStartHour ?? 8,
        endHour: plan.postingWindowEndHour ?? 21,
      },
      aiOptimizationEnabled: plan.aiOptimizationEnabled !== false,
      totals: {
        ...totals,
        averageScore: totals.samples ? Number((totals.score / totals.samples).toFixed(2)) : 0,
        clickThroughRate: totals.views ? Number((totals.clicks / totals.views * 100).toFixed(2)) : 0,
        conversionRate: totals.clicks ? Number((totals.conversions / totals.clicks * 100).toFixed(2)) : 0,
      },
      bestHours: hourlyPerformance.slice(0, 5),
      hourlyPerformance,
      bestContentCombinations: contentCombinations.slice(0, 5),
      contentCombinations,
      hasEnoughData: totals.samples >= 3,
    };
  }

  async recommend(owner, planId) {
    const analytics = await this.getPlanAnalytics(owner, planId);
    const bestHours = analytics.bestHours.filter((item) => item.samples >= 1).map((item) => item.hour);
    const bestCombo = analytics.bestContentCombinations[0] || null;

    return {
      hasEnoughData: analytics.hasEnoughData,
      recommendedHours: bestHours,
      recommendedContentCombination: bestCombo,
      reasoning: analytics.hasEnoughData
        ? 'Recommendations prioritize the user’s historically highest-performing local posting hours and content combinations.'
        : 'Not enough performance samples yet; the scheduler will explore across the preferred posting window until more data is collected.',
    };
  }
}

export { scoreMetrics };
export default new AutoPostingAnalyticsService();
