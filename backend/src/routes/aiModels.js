/**
 * AI Model Registry Routes
 * Provides endpoints for listing AI models, providers, and testing connections.
 */

import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { aiModelRegistry } from '../services/aiModelRegistry.js';
import { reserveAiRequest, settleAiRequest, cancelAiRequest } from '../services/aiUsagePolicy.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

function findModel(modelId, providerId = null) {
  const matches = aiModelRegistry.getAllModels().filter((candidate) =>
    candidate.id === modelId && (!providerId || candidate.providerId === providerId));
  return { matches, model: matches.length === 1 ? matches[0] : null };
}

function safeAiFailure(error, fallback, fallbackCode, status = 503) {
  const safeCodes = new Set(['ai_model_unavailable', 'ai_cost_pricing_not_configured']);
  const code = safeCodes.has(error?.code) ? error.code : fallbackCode;
  const messages = {
    ai_model_unavailable: 'The requested AI model is not currently available.',
    ai_cost_pricing_not_configured: 'AI cost protection is not fully configured, so this request was blocked.',
  };
  return {
    status: Number(error?.statusCode || error?.status) >= 400 ? Number(error?.statusCode || error?.status) : status,
    body: { error: messages[code] || fallback, code },
  };
}

router.get('/', authenticate, (_req, res) => {
  const models = aiModelRegistry.getAllModels();
  res.json({ success: true, models: models.map((m) => ({
    id: m.id, name: m.name, provider: m.providerName, providerId: m.providerId,
    quality: m.quality, speed: m.speed, cost: m.cost, context: m.context,
    vision: m.vision, available: aiModelRegistry.isProviderAvailable(m.providerId),
  })), count: models.length });
});

router.get('/providers', authenticate, (_req, res) => {
  const providers = aiModelRegistry.getAllProviders();
  res.json({ success: true, providers: providers.map((p) => ({
    id: p.id, name: p.name, available: p.available, modelCount: p.models.length,
  })) });
});

router.get('/:modelId', authenticate, (req, res) => {
  const { modelId } = req.params;
  const providerId = req.query.providerId ? String(req.query.providerId) : null;
  const { matches, model } = findModel(modelId, providerId);
  if (!matches.length) return res.status(404).json({ error: 'Model not found', code: 'ai_model_not_found' });
  if (!model) {
    return res.status(409).json({
      error: 'This model ID exists under more than one provider. Specify providerId.',
      code: 'ai_model_provider_required',
      providers: matches.map((candidate) => candidate.providerId),
    });
  }

  res.json({ success: true, model: {
    id: model.id,
    name: model.name,
    provider: model.providerName,
    providerId: model.providerId,
    quality: model.quality,
    speed: model.speed,
    cost: model.cost,
    context: model.context,
    vision: model.vision,
    inputPrice: model.inputPrice,
    outputPrice: model.outputPrice,
    available: aiModelRegistry.isProviderAvailable(model.providerId),
  } });
});

router.post('/test', authenticate, requireAdmin, async (req, res) => {
  const { providerId, modelId, prompt = 'Hello, are you working?' } = req.body;
  if (!providerId || !modelId) return res.status(400).json({ error: 'providerId and modelId are required', code: 'ai_model_identity_required' });
  const { model } = findModel(modelId, providerId);
  if (!model) return res.status(404).json({ error: 'Model not found for this provider', code: 'ai_model_not_found' });
  const provider = aiModelRegistry.getProvider(providerId);
  if (!provider || !provider.isAvailable()) return res.status(503).json({ error: 'Provider not available', code: 'ai_provider_unavailable' });
  try {
    const start = Date.now();
    const result = await provider.generateCompletion(prompt, { model: modelId });
    res.json({ success: true, provider: providerId, model: modelId, response: result.content, duration: Date.now() - start, usage: result.usage });
  } catch (err) {
    logger.error('AI model test failed', { error: err.message, code: err.code, providerId, modelId });
    res.status(502).json({ error: 'The provider model test did not complete successfully.', code: 'ai_model_test_failed' });
  }
});

router.post('/best', authenticate, async (req, res) => {
  const { taskType, userPreferences = {} } = req.body;
  if (!taskType) return res.status(400).json({ error: 'taskType is required', code: 'task_type_required' });
  try {
    const best = aiModelRegistry.getBestModel(taskType, userPreferences);
    if (!best) return res.status(404).json({ error: 'No suitable model found for this task type', code: 'ai_model_not_found' });
    res.json({ success: true, taskType, model: {
      id: best.id, name: best.name, provider: best.providerName, providerId: best.providerId,
      score: best.score, estimatedCost: aiModelRegistry.estimateCost(best.providerId, best.id, 1000, 1000),
    } });
  } catch (err) {
    logger.error('Failed to select best model', { error: err.message, code: err.code, taskType });
    const failure = safeAiFailure(err, 'A suitable AI model could not be selected.', 'ai_model_selection_failed');
    res.status(failure.status).json(failure.body);
  }
});

router.post('/chat', authenticate, async (req, res, next) => {
  const { messages, providerId, modelId, options = {} } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required', code: 'ai_messages_required' });
  }
  if (modelId && providerId) {
    const { model } = findModel(modelId, providerId);
    if (!model) return res.status(404).json({ error: 'Model not found for this provider', code: 'ai_model_not_found' });
  } else if (modelId && !providerId) {
    const { matches } = findModel(modelId);
    if (matches.length > 1) {
      return res.status(409).json({
        error: 'This model ID exists under more than one provider. Specify providerId.',
        code: 'ai_model_provider_required',
        providers: matches.map((candidate) => candidate.providerId),
      });
    }
  }

  let reservation = null;
  try {
    reservation = await reserveAiRequest(req.user?.id, messages, options.maxTokens || 4096, { provider: providerId || null });
    const result = await aiModelRegistry.generateChatCompletion(messages, { provider: providerId, model: modelId, ...options });
    const actualProvider = result.provider || providerId || null;
    const actualModel = result.model || modelId || null;
    await settleAiRequest({ reservation, userId: req.user?.id, operation: 'ai-model-chat', result, provider: actualProvider, model: actualModel });
    reservation = null;
    res.json({ success: true, content: result.content, usage: result.usage, model: actualModel,
      provider: actualProvider || 'default', finishReason: result.finishReason });
  } catch (err) {
    if (reservation) await cancelAiRequest(reservation).catch(() => {});
    if (err?.code === 'plan_quota_exceeded' || err?.status === 402) return next(err);
    logger.error('Chat completion failed', { error: err.message, code: err.code, providerId, modelId });
    const failure = safeAiFailure(err, 'The AI request could not be completed.', 'ai_chat_failed');
    res.status(failure.status).json(failure.body);
  }
});

router.post('/estimate', authenticate, (req, res) => {
  const { providerId, modelId, inputTokens, outputTokens } = req.body;
  if (!providerId || !modelId) return res.status(400).json({ error: 'providerId and modelId are required', code: 'ai_model_identity_required' });
  const { model } = findModel(modelId, providerId);
  if (!model) return res.status(404).json({ error: 'Model not found for this provider', code: 'ai_model_not_found' });
  const safeInput = Math.max(0, Number(inputTokens) || 1000);
  const safeOutput = Math.max(0, Number(outputTokens) || 1000);
  const cost = aiModelRegistry.estimateCost(providerId, modelId, safeInput, safeOutput);
  if (cost === null) return res.status(404).json({ error: 'Model not found', code: 'ai_model_not_found' });
  res.json({ success: true, providerId, modelId, inputTokens: safeInput, outputTokens: safeOutput, estimatedCost: cost, currency: 'USD' });
});

export { findModel, safeAiFailure };
export default router;
