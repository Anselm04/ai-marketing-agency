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

const SAFE_CLIENT_CODES = new Set([
  'CONNECTOR_MISSING',
  'CONNECTOR_OPERATION_MISSING',
  'CONNECTOR_OPERATION_UNAVAILABLE',
  'connector_customer_auth_required',
  'connector_customer_credentials_unavailable',
  'connector_url_params_required',
  'ai_model_unavailable',
  'ai_fallback_exhausted',
  'ai_cost_pricing_not_configured',
]);

function normalizeMessages(content) {
  if (Array.isArray(content)) return content;
  if (content == null) return [];
  return [{ role: 'user', content: String(content) }];
}

function publicFailure(error, fallbackMessage, fallbackCode, fallbackStatus = 500) {
  const suppliedStatus = Number(error?.statusCode || error?.status);
  const status = Number.isInteger(suppliedStatus) && suppliedStatus >= 400 && suppliedStatus <= 599
    ? suppliedStatus
    : fallbackStatus;
  const safeCode = SAFE_CLIENT_CODES.has(error?.code) ? error.code : fallbackCode;

  const safeMessages = {
    CONNECTOR_MISSING: 'No compatible connected integration is available for this operation.',
    CONNECTOR_OPERATION_MISSING: 'The selected integration does not support this operation.',
    CONNECTOR_OPERATION_UNAVAILABLE: 'No connected integration could complete this operation.',
    connector_customer_auth_required: 'Reconnect the required integration for this account before trying again.',
    connector_customer_credentials_unavailable: 'This integration is not available for customer automation yet.',
    connector_url_params_required: 'Required integration account or resource identifiers are missing.',
    ai_model_unavailable: 'The requested AI model is not currently available.',
    ai_fallback_exhausted: 'The configured AI providers could not complete this request.',
    ai_cost_pricing_not_configured: 'AI cost protection is not fully configured, so this request was blocked.',
  };

  return {
    status,
    body: {
      error: safeMessages[safeCode] || fallbackMessage,
      code: safeCode,
    },
  };
}

function sanitizeExecutionErrors(errors = []) {
  return (errors || []).map((item) => {
    const safe = publicFailure(item, 'An orchestration operation could not be completed.', 'orchestration_operation_failed', 500);
    return {
      type: item?.type || 'operation',
      operation: item?.operation || null,
      code: safe.body.code,
      error: safe.body.error,
      retryQueued: item?.retryQueued === true,
      backgroundRetryAvailable: item?.backgroundRetryAvailable === true,
    };
  });
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
    logger.error('Failed to build user profile', { error: err.message, code: err.code, userId: req.user?.id });
    const failure = publicFailure(err, 'Failed to build profile.', 'orchestrator_profile_update_failed');
    res.status(failure.status).json(failure.body);
  }
});

router.get('/profile', authenticate, async (req, res) => {
  try {
    const profile = await intelligentOrchestrator.getUserProfile(req.user?.id);
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
        persisted: profile.persisted !== false,
      },
    });
  } catch (err) {
    logger.error('Failed to get user profile', { error: err.message, code: err.code, userId: req.user?.id });
    const failure = publicFailure(err, 'Failed to load profile.', 'orchestrator_profile_read_failed');
    res.status(failure.status).json(failure.body);
  }
});

router.post('/select-model', authenticate, async (req, res) => {
  const { taskType, content, options = {} } = req.body;
  if (!taskType) return res.status(400).json({ error: 'taskType is required', code: 'task_type_required' });
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
    logger.error('Model selection failed', { error: err.message, code: err.code, userId: req.user?.id, taskType });
    const failure = publicFailure(err, 'No suitable AI model is currently available.', 'model_selection_failed', 503);
    res.status(failure.status).json(failure.body);
  }
});

router.post('/select-connectors', authenticate, async (req, res) => {
  const { taskType, requiredOperations } = req.body;
  if (!taskType) return res.status(400).json({ error: 'taskType is required', code: 'task_type_required' });
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
    logger.error('Connector selection failed', { error: err.message, code: err.code, userId: req.user?.id, taskType });
    const failure = publicFailure(err, 'Integration selection could not be completed.', 'connector_selection_failed');
    res.status(failure.status).json(failure.body);
  }
});

router.post('/execute-ai', authenticate, async (req, res, next) => {
  const { taskType, messages, options = {} } = req.body;
  if (!taskType || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'taskType and messages array are required', code: 'ai_request_invalid' });
  }

  let reservation = null;
  try {
    reservation = await reserveAiRequest(req.user?.id, messages, options.maxTokens || 4096, {
      provider: options.provider || options.providerId || null,
    });
    const result = await intelligentOrchestrator.executeAITask(req.user?.id, taskType, messages, options);
    await settleAiRequest({
      reservation,
      userId: req.user?.id,
      operation: `orchestrator:${taskType}`,
      result,
      provider: result.provider || result.orchestration?.provider,
      model: result.model || result.orchestration?.selectedModel,
    });
    reservation = null;
    res.json({
      success: true,
      content: result.content,
      usage: result.usage,
      model: result.model || result.orchestration?.selectedModel,
      provider: result.provider || result.orchestration?.provider,
      finishReason: result.finishReason,
      orchestration: result.orchestration,
    });
  } catch (err) {
    if (reservation) await cancelAiRequest(reservation).catch(() => {});
    if (err?.code === 'plan_quota_exceeded' || err?.status === 402) return next(err);
    logger.error('AI task execution failed', { error: err.message, code: err.code, userId: req.user?.id, taskType });
    const failure = publicFailure(err, 'The AI request could not be completed.', 'ai_execution_failed', 503);
    res.status(failure.status).json(failure.body);
  }
});

router.post('/execute-campaign', authenticate, async (req, res, next) => {
  const { taskType, content, connectorOperations } = req.body;
  if (!taskType) return res.status(400).json({ error: 'taskType is required', code: 'task_type_required' });

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
        provider: result.ai.provider || result.ai.orchestration?.provider,
        model: result.ai.model || result.ai.orchestration?.selectedModel,
      });
      reservation = null;
    } else if (reservation) {
      await cancelAiRequest(reservation);
      reservation = null;
    }

    const safeErrors = sanitizeExecutionErrors(result.errors);
    const safeConnectors = (result.connectors || []).map((item) => item?.success === false
      ? {
          ...item,
          error: publicFailure(item, 'The integration operation could not be completed.', 'connector_execution_failed').body.error,
        }
      : item);

    res.json({
      success: safeErrors.length === 0,
      ai: result.ai,
      connectors: safeConnectors,
      errors: safeErrors,
      notifications: result.notifications,
    });
  } catch (err) {
    if (reservation) await cancelAiRequest(reservation).catch(() => {});
    if (err?.code === 'plan_quota_exceeded' || err?.status === 402) return next(err);
    logger.error('Campaign orchestration failed', { error: err.message, code: err.code, userId: req.user?.id, taskType });
    const failure = publicFailure(err, 'Campaign orchestration could not be completed.', 'campaign_orchestration_failed');
    res.status(failure.status).json(failure.body);
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
    logger.error('Failed to get suggestions', { error: err.message, code: err.code, userId: req.user?.id });
    const failure = publicFailure(err, 'Connector suggestions could not be loaded.', 'orchestrator_suggestions_failed');
    res.status(failure.status).json(failure.body);
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
    logger.error('Failed to get performance metrics', { error: err.message, code: err.code, userId: req.user?.id });
    const failure = publicFailure(err, 'Performance metrics could not be loaded.', 'orchestrator_metrics_failed');
    res.status(failure.status).json(failure.body);
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
    logger.error('Failed to optimize model selection', { error: err.message, code: err.code, userId: req.user?.id });
    const failure = publicFailure(err, 'Model optimization could not be completed.', 'orchestrator_optimization_failed');
    res.status(failure.status).json(failure.body);
  }
});

router.get('/history', authenticate, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 1000));
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
        error: h.error ? 'This operation did not complete successfully.' : null,
      })),
      count: history.length,
    });
  } catch (err) {
    logger.error('Failed to get task history', { error: err.message, code: err.code, userId: req.user?.id });
    const failure = publicFailure(err, 'Task history could not be loaded.', 'orchestrator_history_failed');
    res.status(failure.status).json(failure.body);
  }
});

export { publicFailure, sanitizeExecutionErrors };
export default router;
