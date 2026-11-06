
import cron from 'node-cron';
import store from '../utils/store.js';
import mediaComposerService from './mediaComposerService.js';
import userVideoPublisherService from './userVideoPublisherService.js';
import { generateAgentResponse } from './openaiService.js';
import { reserveDailyPostQuota } from './planQuotaService.js';
import { recordUsage } from './usageMeteringService.js';
import { releaseQuotaReservation, settleUsageReservation } from './quotaReservationService.js';
import { logger } from '../utils/logger.js';
import autoPostingAnalyticsService from './autoPostingAnalyticsService.js';
import socialPerformanceSyncService from './socialPerformanceSyncService.js';
import {assertManagerOrganicPosting} from './managerOrganicPermissionService.js';

const CADENCE_LIMITS = { daily: 12, weekly: 50, monthly: 120 };
const PERIOD_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

function clampCount(cadence, count) {
  const key = PERIOD_MS[cadence] ? cadence : 'daily';
  return Math.max(1, Math.min(Number(count) || 1, CADENCE_LIMITS[key]));
}

function intervalMs(cadence, postsPerPeriod) {
  const key = PERIOD_MS[cadence] ? cadence : 'daily';
  return Math.max(30 * 60 * 1000, Math.floor(PERIOD_MS[key] / clampCount(key, postsPerPeriod)));
}

function parseMetadata(content, fallback) {
  if (!content || typeof content !== 'string') return fallback;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : content;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return fallback;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return {
      title: String(parsed.title || fallback.title).slice(0, 100),
      caption: String(parsed.caption || fallback.caption).slice(0, 1800),
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map((tag) => String(tag).replace(/^#/, '').trim()).filter(Boolean).slice(0, 15)
        : fallback.hashtags,
    };
  } catch {
    return fallback;
  }
}

class AutoPostingService {
  constructor() {
    this.job = null;
    this.inFlight = new Set();
  }

  normalizePlan(input = {}) {
    const cadence = ['daily', 'weekly', 'monthly'].includes(input.cadence) ? input.cadence : 'daily';
    const postsPerPeriod = clampCount(cadence, input.postsPerPeriod);
    return {
      enabled: input.enabled === true,
      name: String(input.name || 'Automated social posting').trim().slice(0, 120),
      campaignBrief: String(input.campaignBrief || '').trim().slice(0, 3000),
      cadence,
      postsPerPeriod,
      intervalMinutes: Math.round(intervalMs(cadence, postsPerPeriod) / 60000),
      sourceAssetIds: [...new Set((input.sourceAssetIds || []).map(String))].slice(0, 50),
      platformIds: [...new Set((input.platformIds || []).map((id) => String(id).toLowerCase()))].slice(0, 20),
      assetsPerPost: Math.max(1, Math.min(Number(input.assetsPerPost) || 3, 8)),
      aspectRatio: ['9:16', '1:1', '16:9'].includes(input.aspectRatio) ? input.aspectRatio : '9:16',
      secondsPerImage: Math.max(1, Math.min(Number(input.secondsPerImage) || 3, 10)),
      maxVideoSeconds: Math.max(2, Math.min(Number(input.maxVideoSeconds) || 12, 60)),
      startImmediately: input.startImmediately !== false,
      publishingSettings: input.publishingSettings || {},
      timezone: String(input.timezone || 'UTC').slice(0, 100),
      postingWindowStartHour: Math.max(0, Math.min(Number(input.postingWindowStartHour ?? 8), 23)),
      postingWindowEndHour: Math.max(0, Math.min(Number(input.postingWindowEndHour ?? 21), 23)),
      aiOptimizationEnabled: input.aiOptimizationEnabled !== false,
      explorationRate: Math.max(0.05, Math.min(Number(input.explorationRate) || 0.2, 0.5)),
    };
  }

  localHourAt(timestamp, timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || 'UTC',
        hour: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date(timestamp));
      return Number(parts.find((part) => part.type === 'hour')?.value || 0);
    } catch {
      return new Date(timestamp).getUTCHours();
    }
  }

  isHourInWindow(hour, startHour, endHour) {
    if (startHour === endHour) return true;
    if (startHour < endHour) return hour >= startHour && hour < endHour;
    return hour >= startHour || hour < endHour;
  }

  nextEligibleTime(plan, from = Date.now(), preferredHours = []) {
    const start = from + intervalMs(plan.cadence, plan.postsPerPeriod);
    const timezone = plan.timezone || 'UTC';
    const windowStart = Number(plan.postingWindowStartHour ?? 8);
    const windowEnd = Number(plan.postingWindowEndHour ?? 21);
    const preferred = new Set((preferredHours || []).map(Number).filter(Number.isInteger));

    let firstAllowed = null;
    const step = 15 * 60 * 1000;
    const horizon = start + 8 * 24 * 60 * 60 * 1000;

    for (let candidate = start; candidate <= horizon; candidate += step) {
      const hour = this.localHourAt(candidate, timezone);
      if (!this.isHourInWindow(hour, windowStart, windowEnd)) continue;
      if (!firstAllowed) firstAllowed = candidate;
      if (!preferred.size || preferred.has(hour)) return new Date(candidate).toISOString();
    }

    return new Date(firstAllowed || start).toISOString();
  }

  nextRunAt(plan, from = Date.now(), preferredHours = []) {
    return this.nextEligibleTime(plan, from, preferredHours);
  }

  pickAssets(plan, assets, recommendedCombination = null) {
    const source = assets.filter((asset) => plan.sourceAssetIds.includes(String(asset.id)));
    if (!source.length) return [];

    const recommendedIds = recommendedCombination?.sourceAssetIds || [];
    const recommended = recommendedIds
      .map((id) => source.find((asset) => String(asset.id) === String(id)))
      .filter(Boolean);

    const explorationRate = plan.explorationRate ?? 0.2;
    const explorationEvery = Math.max(2, Math.round(1 / explorationRate));
    const shouldExplore = (Number(plan.completedPosts) || 0) % explorationEvery === 0;
    if (recommended.length && !shouldExplore) {
      return recommended.slice(0, Math.min(plan.assetsPerPost || 3, recommended.length));
    }

    const start = Number(plan.rotationIndex || 0) % source.length;
    const count = Math.min(plan.assetsPerPost || 3, source.length);
    return Array.from({ length: count }, (_, index) => source[(start + index) % source.length]);
  }

  async generateMetadata(plan, selectedAssets) {
    const fallback = {
      title: plan.name || 'Social update',
      caption: plan.campaignBrief || 'A fresh update from our latest content.',
      hashtags: ['marketing', 'content', 'video'],
    };

    const result = await generateAgentResponse(
      'social-media',
      [
        'Create metadata for one social video post from the supplied user-selected media.',
        'Return JSON only with title, caption, hashtags.',
        'Do not invent product claims or quotes.',
        'Keep the caption concise and vary the angle so recurring posts do not feel repetitive.',
        'Campaign brief: ' + (plan.campaignBrief || 'No additional brief supplied'),
        'Source media names: ' + selectedAssets.map((asset) => asset.originalName).join(', '),
        'Previous post count: ' + (Number(plan.completedPosts) || 0),
      ].join('\n'),
      { userId: plan.owner },
    );

    return parseMetadata(result && result.content, fallback);
  }

  async runPlan(plan) {
    if (!plan || !plan.enabled) throw new Error('Auto-posting plan is disabled');
    if (plan.requiresManagerEntitlement === true) await assertManagerOrganicPosting({userId:plan.owner,platformIds:plan.platformIds,requiredMode:'full'});
    if (!plan.sourceAssetIds || !plan.sourceAssetIds.length) throw new Error('Auto-posting plan has no selected source media');
    if (!plan.platformIds || !plan.platformIds.length) throw new Error('Auto-posting plan has no selected platforms');

    let postReservation = null;
    try {
      postReservation = (await reserveDailyPostQuota(plan.owner, plan.platformIds.length)).reservation;

      const allContent = await store.getContentByOwner(plan.owner);
      let recommendation = null;
      if (plan.aiOptimizationEnabled !== false) {
        try {
          recommendation = await autoPostingAnalyticsService.recommend(plan.owner, plan.id);
        } catch {
          recommendation = null;
        }
      }

      const selectedAssets = this.pickAssets(
        plan,
        allContent.filter((item) => item.owner === plan.owner && item.kind === 'media_asset'),
        recommendation?.recommendedContentCombination,
      );
      if (!selectedAssets.length) throw new Error('Selected source media is no longer available');

      const metadata = await this.generateMetadata(plan, selectedAssets);
      const generatedVideo = await mediaComposerService.compose({
        ownerId: plan.owner,
        assets: selectedAssets,
        aspectRatio: plan.aspectRatio,
        secondsPerImage: plan.secondsPerImage,
        maxVideoSeconds: plan.maxVideoSeconds,
      });

      const outputRecord = await store.createContent({
        kind: 'generated_video',
        owner: plan.owner,
        mediaType: 'video',
        originalName: 'auto-post-' + Date.now() + '.mp4',
        mimetype: generatedVideo.mimetype,
        size: generatedVideo.size,
        url: generatedVideo.url,
        storageKey: generatedVideo.key,
        aspectRatio: generatedVideo.aspectRatio,
        sourceAssetIds: generatedVideo.sourceAssetIds,
        source: 'auto_posting',
        autoPostingPlanId: plan.id,
        createdAt: generatedVideo.generatedAt,
      });

      // Verify immediately before the irreversible external publication too.
      if (plan.requiresManagerEntitlement === true) await assertManagerOrganicPosting({userId:plan.owner,platformIds:plan.platformIds,requiredMode:'full'});
      const results = await userVideoPublisherService.publishMany({
        userId: plan.owner,
        platformIds: plan.platformIds,
        mediaUrl: generatedVideo.url,
        title: metadata.title,
        caption: metadata.caption,
        hashtags: metadata.hashtags,
        settings: plan.publishingSettings || {},
      });

      const successful = results.filter((result) => result.success).length;
      if (postReservation?.id) {
        await settleUsageReservation({
          id: postReservation.id,
          userId: plan.owner,
          metric: 'social_posts',
          quantity: successful,
          metadata: { autoPostingPlanId: plan.id },
        });
      } else if (successful > 0) {
        await recordUsage({
          userId: plan.owner,
          metric: 'social_posts',
          quantity: successful,
          metadata: { autoPostingPlanId: plan.id },
        });
      }
      postReservation = null;

      const startedAt = new Date().toISOString();
      const localHour = this.localHourAt(Date.now(), plan.timezone || 'UTC');
      const run = {
        id: store._id(),
        startedAt,
        generatedVideoId: outputRecord.id,
        mediaUrl: generatedVideo.url,
        sourceAssetIds: generatedVideo.sourceAssetIds,
        metadata,
        results,
        successful,
        failed: results.length - successful,
        timezone: plan.timezone || 'UTC',
        scheduledLocalHour: this.localHourAt(new Date(plan.nextRunAt || startedAt).getTime(), plan.timezone || 'UTC'),
        actualLocalHour: localHour,
        aspectRatio: plan.aspectRatio,
        assetsPerPost: selectedAssets.length,
        optimizationApplied: Boolean(recommendation?.hasEnoughData),
        optimizationRecommendation: recommendation || null,
      };

      const updated = await store.updateContent(plan.id, {
        completedPosts: (Number(plan.completedPosts) || 0) + 1,
        rotationIndex: (Number(plan.rotationIndex) || 0) + selectedAssets.length,
        lastRunAt: run.startedAt,
        nextRunAt: this.nextRunAt(
          plan,
          Date.now(),
          plan.aiOptimizationEnabled !== false ? recommendation?.recommendedHours || [] : [],
        ),
        lastRun: run,
        recentRuns: [run, ...(plan.recentRuns || [])].slice(0, 20),
        status: successful > 0 ? 'running' : 'attention_required',
        updatedAt: new Date().toISOString(),
      });

      return { plan: updated, run };
    } finally {
      if (postReservation?.id) {
        await releaseQuotaReservation(postReservation.id).catch((error) => {
          logger.warn('Unable to release social post quota reservation', { error: error.message, planId: plan.id });
        });
      }
    }
  }

  start() {
    if (this.job || process.env.AUTO_POSTING_SCHEDULER_ENABLED === 'false') return;
    const expression = process.env.AUTO_POSTING_CRON || '*/5 * * * *';
    this.job = cron.schedule(expression, () => {
      this.runDuePlans().catch((error) => {
        logger.error('Auto-posting scheduler cycle failed', { error: error.message });
      });
    });
    logger.info('Auto-posting scheduler started', { expression });
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
  }

  async runDuePlans(now = Date.now()) {
    const plans = (await store.getContent()).filter(
      (item) => item.kind === 'auto_post_plan'
        && item.enabled === true
        && (!item.nextRunAt || new Date(item.nextRunAt).getTime() <= now),
    );

    for (const plan of plans) {
      if (this.inFlight.has(plan.id)) continue;
      this.inFlight.add(plan.id);
      try {
        if (plan.requiresManagerEntitlement === true) await assertManagerOrganicPosting({userId:plan.owner,platformIds:plan.platformIds,requiredMode:'full'});
        const lastMetricsSync = plan.lastMetricsSyncAt ? new Date(plan.lastMetricsSyncAt).getTime() : 0;
        if (plan.aiOptimizationEnabled !== false && now - lastMetricsSync >= 6 * 60 * 60 * 1000) {
          const sync = await socialPerformanceSyncService.syncPlan(plan);
          await store.updateContent(plan.id, {
            lastMetricsSyncAt: sync.syncedAt,
            lastMetricsSyncSummary: sync,
            updatedAt: new Date().toISOString(),
          });
        }

        let recommendation = null;
        if (plan.aiOptimizationEnabled !== false) {
          try {
            recommendation = await autoPostingAnalyticsService.recommend(plan.owner, plan.id);
          } catch {
            recommendation = null;
          }
        }
        await store.updateContent(plan.id, {
          nextRunAt: this.nextRunAt(plan, now, recommendation?.recommendedHours || []),
          status: 'running',
          updatedAt: new Date().toISOString(),
        });
        await this.runPlan(plan);
      } catch (error) {
        const revoked=plan.requiresManagerEntitlement===true && error.message==='manager_publishing_not_authorized';
        await store.updateContent(plan.id, {
          ...(revoked ? {enabled:false} : {}),
          status: revoked ? 'paused_permission_revoked' : 'attention_required',
          lastError: error.message,
          lastErrorAt: new Date().toISOString(),
          nextRunAt: revoked ? null : this.nextRunAt(plan, now),
          updatedAt: new Date().toISOString(),
        });
        logger.error('Auto-posting plan failed', { planId: plan.id, error: error.message });
      } finally {
        this.inFlight.delete(plan.id);
      }
    }
  }
}

export { CADENCE_LIMITS };
export default new AutoPostingService();
