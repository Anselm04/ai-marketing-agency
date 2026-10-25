import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { aiModelRegistry } from '../services/aiModelRegistry.js';
import orchestrator from '../services/intelligentOrchestrator.js';

afterEach(() => jest.restoreAllMocks());

function configured(qualityThreshold = 0.7) {
  jest.spyOn(orchestrator, 'getUserProfile').mockResolvedValue({ aiPreferences: { qualityThreshold } });
  jest.spyOn(aiModelRegistry, 'getProvider').mockReturnValue({ isAvailable: () => true });
}

describe('model selection with registry metadata', () => {
  test('selects a configured model using quality before task scoring', async () => {
    configured();
    const result = await orchestrator.selectModel('user-1', 'content-generation', 'Write a campaign');
    expect(aiModelRegistry.getAllModels().some((model) => model.id === result.modelId && model.quality >= 0.7)).toBe(true);
    expect(Number.isFinite(result.score)).toBe(true);
  });
  test('never selects below the customer quality threshold', async () => {
    configured(0.99);
    jest.spyOn(aiModelRegistry, 'getAllModels').mockReturnValue([{ id: 'weak', providerId: 'openai', quality: 0.5, score: 1 }]);
    await expect(orchestrator.selectModel('user-1', 'content-generation')).rejects.toThrow('No AI models available');
  });
  test('unconfigured providers remain unavailable', async () => {
    configured();
    aiModelRegistry.getProvider.mockReturnValue({ isAvailable: () => false });
    await expect(orchestrator.selectModel('user-1', 'content-generation')).rejects.toThrow('No AI models available');
  });
});
