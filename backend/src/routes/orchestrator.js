/**
 * Intelligent Orchestrator Routes
 * Provides endpoints for AI model selection, connector recommendations,
 * campaign orchestration, and user profiling.
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { intelligentOrchestrator } from '../services/intelligentOrchestrator.js';
import { reserveAiRequest, settleAiRequest, cancelAiRequest } from '../services/aiUsagePolicy.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

function normalizeMessages(content) {
  if (Array.isArray(content)) return content;
  if (content == null) return [];
  return [{ role: 'user', content: String(content) }];
}

router.post('/profile', authenticate, async (req, res) => {
  const { industry, companySize, budget, goals, preferredTone, language, timezone } = req.body;
  try {
    const profile = await intelligentOrchestrator.buildUserProfile(req.user?.id, {
      industry, companySize, budget, goals, preferredTone, language, timezone,
    });
    res.json({
      success: true,
      profile: {
        userId: profile.userId,
        industry: profile.industry,
        companySize: profile.companySize,
        budget: profile.budget,
        goals: profile.goals,
        preferredTone: profile.preferredTone,
        language: profile.language,
        timezone: profile.timezone,
        connectedConnectors: profile.connectedConnectors.map((c) => ({ id: c.id, name: c.name, category: c.category })),
      },
    });
  } catch (err) {
    logger.error('Failed to build user profile', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to build profile', detail: err.message });
  }
});

router.get('/profile', authenticate, async (req, res) => {
  try {
    const profile = await intelligentOrchestrator.getUserProfile(req.user?.id);
    if (!profile) return res.json({ success: true, profile: null, message: 'No profile found. Create one via POST /api/orchestrator/profile' });
    res.json({
      success: true,
      profile: {
        userId: profile.userId,
        industry: profile.industry,
        companySize: profile.companySize,
        budget: profile.budget,
        goals: profile.goals,
        preferredTone: profile.preferredTone,
        language: profile.language,
        timezone: profile.timezone,
        connectedConnectors: profile.connectedConnectors.map((c) => ({ id: c.id, name: c.name, category: c.category })),
        lastUpdated: profile.lastUpdated,
      },
    });
  } catch (err) {
    logger.error('Failed to get user profile', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get profile', detail: err.message });
  }
});

router.post('/select-model', authenticate, async (req, res) => {
  const { taskType, content, options = {} } = req.body;
  if (!taskType) return res.status(400).json({ error: 'taskType is required' });
  try {
    const selection = await intelligentOrchestrator.selectModel(req.user?.id, taskType, content, options);
    res.json({
      success: true,
      selection: {
        modelId: selection.modelId,
        providerId: selection.providerId,
        modelName: selection.modelName,
        score: selection.score,
        estimatedCost: selection.estimatedCost,
        alternatives: selection.alternatives,
        context: selection.context,
      },
    });
  } catch (err) {
    logger.error('Model selection failed', { error: err.message, userId: req.user?.id, taskType });
    res.status(500).json({ error: 'Model selection failed', detail: err.message });
  }
});

router.post('/select-connectors', authenticate, async (req, res) => {
  const { taskType, requiredOperations } = req.body;
  if (!taskType) return res.status(400).json({ error: 'taskType is required' });
  try {
    const result = await intelligentOrchestrator.selectConnectors(req.user?.id, taskType, requiredOperations || []);
    res.json({
      success: true,
      taskType,
      selected: result.selected,
      missing: result.missing,
      suggestions: result.suggestions,
      connectedCount: result.connectedCount,
    });
  } catch (err) {
    logger.error('Connector selection failed', { error: err.message, userId: req.user?.id, taskType });
    res.status(500).json({ error: 'Connector selection failed', detail: err.message });
  }
});

router.post('/execute-ai', authenticate, async (req, res, next) => {
  const { taskType, messages, options = {} } = req.body;
  if (!taskType || !messages || !Array.isArray(messages)) return res.status(400).json({ error: 'taskType and messages array are required' });

  let reservation = null;
  try {
    reservation = await reserveAiRequest(req.user?.id, messages, options.maxTokens || 4096);
    const result = await intelligentOrchestrator.executeAITask(req.user?.id, taskType, messages, options);
    await settleAiRequest({
      reservation,
      userId: req.user?.id,
      operation: `orchestrator:${taskType}`,
      result,
      provider: result.provider,
      model: result.model,
    });
    reservation = null;
    res.json({
      success: true,
      content: result.content,
      usage: result.usage,
      model: result.model,
      provider: result.provider,
      finishReason: result.finishReason,
      orchestration: result.orchestration,
    });
  } catch (err) {
    if (reservation) await cancelAiRequest(reservation).catch(() => {});
    if (err?.code === 'plan_quota_exceeded' || err?.status === 402) return next(err);
    logger.error('AI task execution failed', { error: err.message, userId: req.user?.id, taskType });
    res.status(500).json({ error: 'AI task execution failed', detail: err.message });
  }
});

router.post('/execute-campaign', authenticate, async (req, res, next) => {
  const { taskType, content, connectorOperations } = req.body;
  if (!taskType) return res.status(400).json({ error: 'taskType is required' });

  const messages = normalizeMessages(content);
  let reservation = null;
  try {
    if (messages.length) reservation = await reserveAiRequest(req.user?.id, messages, 4096);
    const result = await intelligentOrchestrator.executeCampaignOrchestration(req.user?.id, {
      taskType,
      content: messages,
      connectorOperations: connectorOperations || [],
    });
    if (reservation && result.ai?.usage) {
      await settleAiRequest({
        reservation,
        userId: req.user?.id,
        operation: `campaign-orchestrator:${taskType}`,
        result: result.ai,
        provider: result.ai.provider,
        model: result.ai.model,
      });
      reservation = null;
    } else if (reservation) {
      await cancelAiRequest(reservation);
      reservation = null;
    }

    res.json({
      success: result.errors.length === 0,
      ai: result.ai,
      connectors: result.connectors,
      errors: result.errors,
      notifications: result.notifications,
    });
  } catch (err) {
    if (reservation) await cancelAiRequest(reservation).catch(() => {});
    if (err?.code === 'plan_quota_exceeded' || err?.status === 402) return next(err);
    logger.error('Campaign orchestration failed', { error: err.message, userId: req.user?.id, taskType });
    res.status(500).json({ error: 'Campaign orchestration failed', detail: err.message });
  }
});

router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const suggestions = await intelligentOrchestrator.getConnectorSuggestions(req.user?.id);
    res.json({
      success: true,
      suggestions: suggestions.map((s) => ({
        connectorId: s.connectorId,
        name: s.name,
        category: s.category,
        relevance: s.relevance,
        reason: s.reason,
      })),
      count: suggestions.length,
    });
  } catch (err) {
    logger.error('Failed to get suggestions', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get suggestions', detail: err.message });
  }
});

router.get('/performance', authenticate, async (req, res) => {
  try {
    const metrics = await intelligentOrchestrator.getPerformanceMetrics(req.user?.id);
    res.json({
      success: true,
      metrics: {
        totalTasks: metrics.totalTasks,
        aiTasks: metrics.aiTasks,
        connectorTasks: metrics.connectorTasks,
        totalCost: metrics.totalCost,
        successRate: metrics.successRate,
        avgDuration: metrics.avgDuration,
        topModels: metrics.topModels,
        topConnectors: metrics.topConnectors,
      },
    });
  } catch (err) {
    logger.error('Failed to get performance metrics', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get metrics', detail: err.message });
  }
});

router.post('/optimize', authenticate, async (req, res) => {
  try {
    const optimization = await intelligentOrchestrator.optimizeModelSelection(req.user?.id);
    res.json({
      success: true,
      optimization: {
        currentSuccessRate: optimization.currentSuccessRate,
        currentCost: optimization.currentCost,
        suggestions: optimization.suggestions,
        recommendation: optimization.recommendation,
      },
    });
  } catch (err) {
    logger.error('Failed to optimize model selection', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Optimization failed', detail: err.message });
  }
});

router.get('/history', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = await intelligentOrchestrator.getTaskHistory(req.user?.id, limit);
    res.json({
      success: true,
      history: history.map((h) => ({
        taskType: h.taskType,
        status: h.status,
        modelId: h.modelId,
        connectorId: h.connectorId,
        duration: h.duration,
        cost: h.cost,
        timestamp: h.timestamp,
        error: h.error || null,
      })),
      count: history.length,
    });
  } catch (err) {
    logger.error('Failed to get task history', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get history', detail: err.message });
  }
});

export default router;
