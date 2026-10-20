import { beforeEach, describe, expect, test } from '@jest/globals';
import {
  estimateConfiguredAiCost,
  recordAiUsage,
  recordUsage,
  resetMemoryUsageForTests,
  sumUsage,
} from '../services/usageMeteringService.js';

describe('usage metering', () => {
  beforeEach(() => {
    resetMemoryUsageForTests();
    delete process.env.OPENAI_INPUT_USD_PER_1M;
    delete process.env.OPENAI_OUTPUT_USD_PER_1M;
  });

  test('sums customer usage by metric and time window', async () => {
    await recordUsage({ userId: 'user-a', metric: 'ai_tokens', quantity: 100, createdAt: '2026-10-01T00:00:00.000Z' });
    await recordUsage({ userId: 'user-a', metric: 'ai_tokens', quantity: 200, createdAt: '2026-10-02T00:00:00.000Z' });
    await recordUsage({ userId: 'user-b', metric: 'ai_tokens', quantity: 900, createdAt: '2026-10-02T00:00:00.000Z' });

    const total = await sumUsage({
      userId: 'user-a',
      metric: 'ai_tokens',
      since: '2026-10-01T00:00:00.000Z',
      until: '2026-11-01T00:00:00.000Z',
    });
    expect(total).toBe(300);
  });

  test('records actual customer AI tokens from provider usage', async () => {
    await recordAiUsage({
      userId: 'user-a',
      provider: 'openai',
      model: 'gpt-test',
      operation: 'agent-response',
      usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
      createdAt: '2026-10-02T00:00:00.000Z',
    });

    const total = await sumUsage({
      userId: 'user-a',
      metric: 'ai_tokens',
      since: '2026-10-01T00:00:00.000Z',
      until: '2026-11-01T00:00:00.000Z',
    });
    expect(total).toBe(200);
  });

  test('does not invent provider cost when pricing is not configured', () => {
    expect(estimateConfiguredAiCost('openai', { prompt_tokens: 1000, completion_tokens: 500 })).toBeNull();
  });

  test('uses explicitly configured per-million-token pricing', () => {
    process.env.OPENAI_INPUT_USD_PER_1M = '1';
    process.env.OPENAI_OUTPUT_USD_PER_1M = '2';
    expect(estimateConfiguredAiCost('openai', { prompt_tokens: 1_000_000, completion_tokens: 500_000 })).toBe(2);
  });
});
