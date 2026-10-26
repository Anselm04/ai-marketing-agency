import { aiModelRegistry } from './aiModelRegistry.js';
import { intelligentOrchestrator } from './intelligentOrchestrator.js';
import { logger } from '../utils/logger.js';

function modelById(modelId, providerId = null) {
  return aiModelRegistry.getAllModels().find((model) =>
    model.id === modelId && (!providerId || model.providerId === providerId)) || null;
}

function candidateFromModel(model) {
  if (!model) return null;
  const provider = aiModelRegistry.getProvider(model.providerId);
  if (!provider?.isAvailable?.()) return null;
  return { modelId: model.id, providerId: model.providerId, modelName: model.name };
}

function candidateKey(candidate) {
  return `${candidate?.providerId || ''}:${candidate?.modelId || ''}`;
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = candidateKey(candidate);
    if (!candidate?.modelId || !candidate?.providerId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fallbackCandidates(selection = {}, options = {}) {
  if (Array.isArray(options.fallbackChain) && options.fallbackChain.length) {
    return options.fallbackChain.map((item) => {
      if (typeof item === 'object' && item?.id) {
        return candidateFromModel(modelById(item.id, item.provider || item.providerId || null));
      }
      return candidateFromModel(modelById(item));
    });
  }

  const alternatives = (selection.alternatives || []).map((item) =>
    candidateFromModel(modelById(item.id, item.provider || item.providerId || null)));
  const alternativeKeys = new Set(alternatives.filter(Boolean).map(candidateKey));
  const legacy = (selection.fallbackChain || [])
    .map((modelId) => candidateFromModel(modelById(modelId)))
    .filter((candidate) => !alternativeKeys.has(candidateKey(candidate)));
  return [...alternatives, ...legacy];
}

export function installOrchestratorAiFallbackPatch(service = intelligentOrchestrator) {
  if (!service || service.__aiFallbackPatchApplied) return service;

  service.executeAITask = async function executeBoundedAiTask(userId, taskType, messages, options = {}) {
    const joined = (messages || []).map((message) => String(message?.content || '')).join(' ');
    const selection = await service.selectModel(userId, taskType, joined, options);

    const requestedProvider = options.provider || options.providerId || null;
    const forced = options.model
      ? candidateFromModel(modelById(options.model, requestedProvider))
      : null;
    if (options.model && !forced) {
      const requested = requestedProvider ? `${requestedProvider}/${options.model}` : options.model;
      const error = new Error(`Requested AI model is unavailable: ${requested}`);
      error.code = 'ai_model_unavailable';
      error.statusCode = 503;
      throw error;
    }

    const primary = forced || candidateFromModel(modelById(selection.modelId, selection.providerId)) || {
      modelId: selection.modelId,
      providerId: selection.providerId,
      modelName: selection.modelName,
    };

    const candidates = uniqueCandidates([
      primary,
      ...fallbackCandidates(selection, options),
    ]).slice(0, 5);

    if (!candidates.length) {
      const error = new Error('No configured AI model is available for this task.');
      error.code = 'ai_model_unavailable';
      error.statusCode = 503;
      throw error;
    }

    const {
      model: _ignoredModel,
      provider: _ignoredProvider,
      providerId: _ignoredProviderId,
      fallbackChain: _ignoredFallback,
      ...providerOptions
    } = options;
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

        const usedFallback = candidateKey(candidate) !== candidateKey(primary);
        await service.logTaskHistory(userId, taskType, {
          modelId: candidate.modelId,
          providerId: candidate.providerId,
          status: 'success',
          duration: Date.now() - started,
          cost: aiModelRegistry.estimateCost(candidate.providerId, candidate.modelId, 1000, 1000),
          metadata: { fallbackUsed: usedFallback },
        });

        return {
          ...result,
          provider: result.provider || candidate.providerId,
          model: result.model || candidate.modelId,
          orchestration: {
            selectedModel: candidate.modelId,
            provider: candidate.providerId,
            requestedPrimaryModel: primary.modelId,
            requestedPrimaryProvider: primary.providerId,
            fallbackUsed: usedFallback,
            attemptedModels: candidates
              .slice(0, candidates.indexOf(candidate) + 1)
              .map((item) => ({ modelId: item.modelId, providerId: item.providerId })),
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