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

router.get('/', authenticate, (req, res) => {
  const models = aiModelRegistry.getAllModels();
  res.json({ success: true, models: models.map((m) => ({
    id: m.id, name: m.name, provider: m.providerName, providerId: m.providerId,
    quality: m.quality, speed: m.speed, cost: m.cost, context: m.context,
    vision: m.vision, available: aiModelRegistry.isProviderAvailable(m.providerId),
  })), count: models.length });
});

router.get('/providers', authenticate, (req, res) => {
  const providers = aiModelRegistry.getAllProviders();
  res.json({ success: true, providers: providers.map((p) => ({
    id: p.id, name: p.name, available: p.available, modelCount: p.models.length,
  })) });
});

router.get('/:modelId', authenticate, (req, res) => {
  const { modelId } = req.params;
  const info = aiModelRegistry.getModelInfo(modelId);
  if (!info) return res.status(404).json({ error: 'Model not found' });
  const providerId = Object.keys(aiModelRegistry.getAllProviders().find((p) => p.models.find((m) => m.id === modelId))?.id || {});
  res.json({ success: true, model: {
    id: modelId, name: info.name, quality: info.quality, speed: info.speed, cost: info.cost,
    context: info.context, vision: info.vision, inputPrice: info.inputPrice, outputPrice: info.outputPrice,
    available: aiModelRegistry.isProviderAvailable(providerId),
  } });
});

router.post('/test', authenticate, requireAdmin, async (req, res) => {
  const { providerId, modelId, prompt = 'Hello, are you working?' } = req.body;
  if (!providerId || !modelId) return res.status(400).json({ error: 'providerId and modelId are required' });
  const provider = aiModelRegistry.getProvider(providerId);
  if (!provider || !provider.isAvailable()) return res.status(400).json({ error: 'Provider not available' });
  try {
    const start = Date.now();
    const result = await provider.generateCompletion(prompt, { model: modelId });
    res.json({ success: true, provider: providerId, model: modelId, response: result.content, duration: Date.now() - start, usage: result.usage });
  } catch (err) {
    logger.error('AI model test failed', { error: err.message, providerId, modelId });
    res.status(500).json({ error: 'Model test failed', detail: err.message });
  }
});

router.post('/best', authenticate, async (req, res) => {
  const { taskType, userPreferences = {} } = req.body;
  if (!taskType) return res.status(400).json({ error: 'taskType is required' });
  try {
    const best = aiModelRegistry.getBestModel(taskType, userPreferences);
    if (!best) return res.status(404).json({ error: 'No suitable model found for this task type' });
    res.json({ success: true, taskType, model: {
      id: best.id, name: best.name, provider: best.providerName, providerId: best.providerId,
      score: best.score, estimatedCost: aiModelRegistry.estimateCost(best.providerId, best.id, 1000, 1000),
    } });
  } catch (err) {
    logger.error('Failed to select best model', { error: err.message, taskType });
    res.status(500).json({ error: 'Failed to select model', detail: err.message });
  }
});

router.post('/chat', authenticate, async (req, res, next) => {
  const { messages, providerId, modelId, options = {} } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages array is required' });

  let reservation = null;
  try {
    reservation = await reserveAiRequest(req.user?.id, messages, options.maxTokens || 4096);
    const result = await aiModelRegistry.generateChatCompletion(messages, { provider: providerId, model: modelId, ...options });
    await settleAiRequest({ reservation, userId: req.user?.id, operation: 'ai-model-chat', result, provider: providerId, model: modelId });
    reservation = null;
    res.json({ success: true, content: result.content, usage: result.usage, model: result.model,
      provider: result.provider || providerId || 'default', finishReason: result.finishReason });
  } catch (err) {
    if (reservation) await cancelAiRequest(reservation).catch(() => {});
    if (err?.code === 'plan_quota_exceeded' || err?.status === 402) return next(err);
    logger.error('Chat completion failed', { error: err.message, providerId, modelId });
    res.status(500).json({ error: 'Chat completion failed', detail: err.message });
  }
});

router.post('/estimate', authenticate, (req, res) => {
  const { providerId, modelId, inputTokens, outputTokens } = req.body;
  if (!providerId || !modelId) return res.status(400).json({ error: 'providerId and modelId are required' });
  const cost = aiModelRegistry.estimateCost(providerId, modelId, inputTokens || 1000, outputTokens || 1000);
  if (cost === null) return res.status(404).json({ error: 'Model not found' });
  res.json({ success: true, providerId, modelId, inputTokens: inputTokens || 1000, outputTokens: outputTokens || 1000, estimatedCost: cost, currency: 'USD' });
});

export default router;
