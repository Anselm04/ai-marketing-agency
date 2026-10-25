import { aiModelRegistry } from './aiModelRegistry.js';
import { intelligentOrchestrator } from './intelligentOrchestrator.js';
import { logger } from '../utils/logger.js';

function modelById(modelId) {
  return aiModelRegistry.getAllModels().find((model) => model.id === modelId) || null;
}

function candidateFromModel(model) {
  if (!model) return null;
  const provider = aiModelRegistry.getProvider(model.providerId);
  if (!provider?.isAvailable?.()) return null;
  return { modelId: model.id, providerId: model.providerId, modelName: model.name };
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate?.modelId || seen.has(candidate.modelId)) return false;
    seen.add(candidate.modelId);
    return true;
  });
}

export function installOrchestratorAiFallbackPatch(service = intelligentOrchestrator) {
  if (!service || service.__aiFallbackPatchApplied) return service;

  service.executeAITask = async function executeBoundedAiTask(userId, taskType, messages, options = {}) {
    const joined = (messages || []).map((message) => String(message?.content || '')).join(' ');
    const selection = await service.selectModel(userId, taskType, joined, options);

    const forced = options.model ? candidateFromModel(modelById(options.model)) : null;
    if (options.model && !forced) {
      const error = new Error(`Requested AI model is unavailable: ${options.model}`);
      error.code = 'ai_model_unavailable';
      error.statusCode = 503;
      throw error;
    }

    const primary = forced || candidateFromModel(modelById(selection.modelId)) || {
      modelId: selection.modelId,
      providerId: selection.providerId,
      modelName: selection.modelName,
    };

    const requestedFallbackIds = Array.isArray(options.fallbackChain) && options.fallbackChain.length
      ? options.fallbackChain
      : [
          ...(selection.fallbackChain || []),
          ...(selection.alternatives || []).map((item) => item.id),
        ];

    const candidates = uniqueCandidates([
      primary,
      ...requestedFallbackIds.map((modelId) => candidateFromModel(modelById(modelId))),
    ]).slice(0, 5);

    if (!candidates.length) {
      const error = new Error('No configured AI model is available for this task.');
      error.code = 'ai_model_unavailable';
      error.statusCode = 503;
      throw error;
    }

    const { model: _ignoredModel, provider: _ignoredProvider, fallbackChain: _ignoredFallback, ...providerOptions } = options;
    let lastError = null;

    for (const candidate of candidates) {
      const started = Date.now();
      try {
        const result = await aiModelRegistry.generateChatCompletion(messages, {
          ...providerOptions,
          provider: candidate.providerId,
          model: candidate.modelId,
          fallbackChain: [],
        });

        await service.logTaskHistory(userId, taskType, {
          modelId: candidate.modelId,
          providerId: candidate.providerId,
          status: 'success',
          duration: Date.now() - started,
          cost: aiModelRegistry.estimateCost(candidate.providerId, candidate.modelId, 1000, 1000),
          metadata: { fallbackUsed: candidate.modelId !== primary.modelId },
        });

        return {
          ...result,
          orchestration: {
            selectedModel: candidate.modelId,
            provider: candidate.providerId,
            requestedPrimaryModel: primary.modelId,
            fallbackUsed: candidate.modelId !== primary.modelId,
            attemptedModels: candidates.slice(0, candidates.indexOf(candidate) + 1).map((item) => item.modelId),
            alternatives: selection.alternatives || [],
            estimatedCost: aiModelRegistry.estimateCost(candidate.providerId, candidate.modelId, 1000, 1000),
          },
        };
      } catch (error) {
        lastError = error;
        await service.logTaskHistory(userId, taskType, {
          modelId: candidate.modelId,
          providerId: candidate.providerId,
          status: 'error',
          duration: Date.now() - started,
          error: error.message,
        }).catch(() => {});
        logger.warn('AI orchestration candidate failed', {
          userId,
          taskType,
          provider: candidate.providerId,
          model: candidate.modelId,
          error: error.message,
        });
      }
    }

    const error = lastError || new Error('All configured AI candidates failed.');
    if (!error.code) error.code = 'ai_fallback_exhausted';
    if (!error.statusCode && !error.status) error.statusCode = 503;
    throw error;
  };

  Object.defineProperty(service, '__aiFallbackPatchApplied', {
    value: true,
    enumerable: false,
  });
  return service;
}

export default installOrchestratorAiFallbackPatch;