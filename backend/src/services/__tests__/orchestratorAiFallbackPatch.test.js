import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const generateChatCompletion = jest.fn();
const estimateCost = jest.fn(() => 0.01);
const providers = {
  providerA: { isAvailable: () => true },
  providerB: { isAvailable: () => true },
};
const models = [
  { id: 'model-a', providerId: 'providerA', name: 'Model A' },
  { id: 'model-b', providerId: 'providerB', name: 'Model B' },
  { id: 'shared-model', providerId: 'providerA', name: 'Shared A' },
  { id: 'shared-model', providerId: 'providerB', name: 'Shared B' },
];

jest.unstable_mockModule('../aiModelRegistry.js', () => ({
  aiModelRegistry: {
    getAllModels: () => models,
    getProvider: (id) => providers[id] || null,
    generateChatCompletion,
    estimateCost,
  },
}));

const { installOrchestratorAiFallbackPatch } = await import('../orchestratorAiFallbackPatch.js');

function service() {
  return {
    selectModel: jest.fn(async () => ({
      modelId: 'model-a',
      providerId: 'providerA',
      modelName: 'Model A',
      fallbackChain: ['model-b'],
      alternatives: [{ id: 'model-b', provider: 'providerB', name: 'Model B' }],
    })),
    logTaskHistory: jest.fn(async () => {}),
  };
}

beforeEach(() => {
  generateChatCompletion.mockReset();
  estimateCost.mockClear();
});

describe('bounded AI orchestration fallback', () => {
  test('tries each candidate once and advances to the next model after failure', async () => {
    const target = installOrchestratorAiFallbackPatch(service());
    generateChatCompletion
      .mockRejectedValueOnce(new Error('provider A unavailable'))
      .mockResolvedValueOnce({
        content: 'real answer',
        model: 'model-b',
        provider: 'providerB',
        usage: { total_tokens: 12 },
      });

    const result = await target.executeAITask('user-1', 'content-generation', [{ role: 'user', content: 'hello' }]);

    expect(generateChatCompletion).toHaveBeenCalledTimes(2);
    expect(generateChatCompletion.mock.calls[0][1]).toMatchObject({ provider: 'providerA', model: 'model-a', fallbackChain: [] });
    expect(generateChatCompletion.mock.calls[1][1]).toMatchObject({ provider: 'providerB', model: 'model-b', fallbackChain: [] });
    expect(result.orchestration).toMatchObject({
      selectedModel: 'model-b',
      provider: 'providerB',
      requestedPrimaryModel: 'model-a',
      requestedPrimaryProvider: 'providerA',
      fallbackUsed: true,
      attemptedModels: [
        { modelId: 'model-a', providerId: 'providerA' },
        { modelId: 'model-b', providerId: 'providerB' },
      ],
    });
  });

  test('does not recurse forever when every candidate fails', async () => {
    const target = installOrchestratorAiFallbackPatch(service());
    generateChatCompletion.mockRejectedValue(new Error('all unavailable'));

    await expect(target.executeAITask('user-2', 'content-generation', [{ role: 'user', content: 'hello' }]))
      .rejects.toThrow('all unavailable');
    expect(generateChatCompletion).toHaveBeenCalledTimes(2);
  });

  test('honors an explicitly requested available model as the primary candidate', async () => {
    const target = installOrchestratorAiFallbackPatch(service());
    generateChatCompletion.mockResolvedValueOnce({ content: 'forced', model: 'model-b', usage: { total_tokens: 5 } });

    const result = await target.executeAITask(
      'user-3',
      'content-generation',
      [{ role: 'user', content: 'hello' }],
      { model: 'model-b' },
    );

    expect(generateChatCompletion).toHaveBeenCalledTimes(1);
    expect(generateChatCompletion.mock.calls[0][1]).toMatchObject({ provider: 'providerB', model: 'model-b' });
    expect(result.orchestration.fallbackUsed).toBe(false);
  });

  test('binds duplicate model ids to the explicitly requested provider', async () => {
    const target = installOrchestratorAiFallbackPatch(service());
    generateChatCompletion.mockResolvedValueOnce({ content: 'provider B result', usage: { total_tokens: 7 } });

    const result = await target.executeAITask(
      'user-4',
      'content-generation',
      [{ role: 'user', content: 'hello' }],
      { model: 'shared-model', provider: 'providerB' },
    );

    expect(generateChatCompletion).toHaveBeenCalledTimes(1);
    expect(generateChatCompletion.mock.calls[0][1]).toMatchObject({ provider: 'providerB', model: 'shared-model' });
    expect(result.provider).toBe('providerB');
    expect(result.model).toBe('shared-model');
    expect(result.orchestration).toMatchObject({
      requestedPrimaryModel: 'shared-model',
      requestedPrimaryProvider: 'providerB',
      selectedModel: 'shared-model',
      provider: 'providerB',
    });
  });
});