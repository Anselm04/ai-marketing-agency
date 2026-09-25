
import express from 'express';
import store from '../utils/store.js';
import autoPostingService, { CADENCE_LIMITS } from '../services/autoPostingService.js';
import { videoPlatformCatalog } from '../services/videoPlatformCatalog.js';
import { getTokens } from '../services/appConnector.js';
import autoPostingAnalyticsService from '../services/autoPostingAnalyticsService.js';
import socialPerformanceSyncService from '../services/socialPerformanceSyncService.js';

const router = express.Router();

function ownerId(req) {
  return req.user?.id || req.userId;
}

async function ownedPlan(req, res) {
  const plan = (await store.getContent()).find(
    (item) => String(item.id) === String(req.params.id)
      && item.owner === ownerId(req)
      && item.kind === 'auto_post_plan',
  );
  if (!plan) res.status(404).json({ error: 'Auto-posting plan not found' });
  return plan || null;
}

async function validatePlatforms(userId, platformIds) {
  const direct = videoPlatformCatalog.filter((platform) => platform.publish === 'direct_api');
  const allowed = [];
  const unavailable = [];

  for (const platformId of platformIds) {
    const platform = direct.find((item) => item.id === platformId);
    if (!platform || !platform.connectorId) {
      unavailable.push({ platformId, reason: 'Direct publishing is not available' });
      continue;
    }
    const tokens = await getTokens(userId, platform.connectorId);
    if (!tokens) {
      unavailable.push({ platformId, reason: 'Connect this social account first' });
      continue;
    }
    allowed.push(platformId);
  }

  return { allowed, unavailable };
}

router.get('/limits', (req, res) => {
  res.json({ cadenceLimits: CADENCE_LIMITS });
});

router.get('/', async (req, res) => {
  const owner = ownerId(req);
  const plans = (await store.getContent())
    .filter((item) => item.owner === owner && item.kind === 'auto_post_plan')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ plans });
});

router.post('/', async (req, res) => {
  const owner = ownerId(req);
  const normalized = autoPostingService.normalizePlan(req.body || {});

  if (!normalized.sourceAssetIds.length) {
    return res.status(400).json({ error: 'Select source photos/videos for the automation' });
  }
  if (!normalized.platformIds.length) {
    return res.status(400).json({ error: 'Select at least one platform' });
  }

  const media = (await store.getContent()).filter(
    (item) => item.owner === owner
      && item.kind === 'media_asset'
      && normalized.sourceAssetIds.includes(String(item.id)),
  );
  if (media.length !== normalized.sourceAssetIds.length) {
    return res.status(404).json({ error: 'One or more selected source media items were not found' });
  }

  const platformCheck = await validatePlatforms(owner, normalized.platformIds);
  if (platformCheck.unavailable.length) {
    return res.status(409).json({
      error: 'One or more selected platforms are not ready for automatic posting',
      unavailable: platformCheck.unavailable,
    });
  }

  const now = Date.now();
  const plan = await store.createContent({
    kind: 'auto_post_plan',
    owner,
    ...normalized,
    status: normalized.enabled ? 'running' : 'paused',
    completedPosts: 0,
    rotationIndex: 0,
    nextRunAt: normalized.enabled
      ? (
        normalized.startImmediately
          && autoPostingService.isHourInWindow(
            autoPostingService.localHourAt(now, normalized.timezone),
            normalized.postingWindowStartHour,
            normalized.postingWindowEndHour,
          )
          ? new Date(now).toISOString()
          : autoPostingService.nextRunAt(normalized, now - (normalized.intervalMinutes * 60 * 1000))
      )
      : null,
    recentRuns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.status(201).json(plan);
});

router.patch('/:id', async (req, res) => {
  const existing = await ownedPlan(req, res);
  if (!existing) return;

  const normalized = autoPostingService.normalizePlan({ ...existing, ...req.body });
  if (!normalized.sourceAssetIds.length || !normalized.platformIds.length) {
    return res.status(400).json({ error: 'Source media and at least one platform are required' });
  }

  const platformCheck = await validatePlatforms(ownerId(req), normalized.platformIds);
  if (platformCheck.unavailable.length) {
    return res.status(409).json({
      error: 'One or more selected platforms are not ready for automatic posting',
      unavailable: platformCheck.unavailable,
    });
  }

  const enabledChanged = req.body?.enabled !== undefined && req.body.enabled !== existing.enabled;
  const updated = await store.updateContent(existing.id, {
    ...normalized,
    status: normalized.enabled ? 'running' : 'paused',
    nextRunAt: normalized.enabled
      ? (enabledChanged ? new Date().toISOString() : existing.nextRunAt || autoPostingService.nextRunAt(normalized))
      : null,
    updatedAt: new Date().toISOString(),
  });
  res.json(updated);
});


router.post('/:id/sync-analytics', async (req, res) => {
  const plan = await ownedPlan(req, res);
  if (!plan) return;

  try {
    const sync = await socialPerformanceSyncService.syncPlan(plan);
    await store.updateContent(plan.id, {
      lastMetricsSyncAt: sync.syncedAt,
      lastMetricsSyncSummary: sync,
      updatedAt: new Date().toISOString(),
    });
    const analytics = await autoPostingAnalyticsService.getPlanAnalytics(ownerId(req), plan.id);
    const recommendation = await autoPostingAnalyticsService.recommend(ownerId(req), plan.id);
    res.json({ sync, analytics, recommendation });
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

router.get('/:id/analytics', async (req, res) => {
  const plan = await ownedPlan(req, res);
  if (!plan) return;

  try {
    const analytics = await autoPostingAnalyticsService.getPlanAnalytics(ownerId(req), plan.id);
    const recommendation = await autoPostingAnalyticsService.recommend(ownerId(req), plan.id);
    res.json({ analytics, recommendation });
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

router.post('/:id/metrics', async (req, res) => {
  const plan = await ownedPlan(req, res);
  if (!plan) return;

  const { runId, platformId, metrics, observedAt } = req.body || {};
  if (!runId || !platformId || !metrics || typeof metrics !== 'object') {
    return res.status(400).json({ error: 'runId, platformId and metrics are required' });
  }

  try {
    const record = await autoPostingAnalyticsService.recordMetrics({
      owner: ownerId(req),
      planId: plan.id,
      runId,
      platformId,
      metrics,
      observedAt,
    });
    const analytics = await autoPostingAnalyticsService.getPlanAnalytics(ownerId(req), plan.id);
    res.status(201).json({ record, analytics });
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

router.post('/:id/run-now', async (req, res) => {
  const plan = await ownedPlan(req, res);
  if (!plan) return;

  try {
    const result = await autoPostingService.runPlan({ ...plan, enabled: true });
    res.json(result);
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const plan = await ownedPlan(req, res);
  if (!plan) return;
  await store.deleteContent(plan.id);
  res.json({ success: true });
});

export default router;
