import { afterEach, describe, expect, test } from '@jest/globals';
import {
  aiMonetaryCapStatus,
  configuredAiPricing,
  configuredMonthlyAiCostCap,
  estimateAiRequestCostUsd,
} from '../aiMonetaryCapService.js';

const keys = [
  'AI_MONTHLY_USD_CAP',
  'AI_MONTHLY_USD_CAP_STARTER',
  'OPENAI_INPUT_USD_PER_1M',
  'OPENAI_OUTPUT_USD_PER_1M',
];
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    if (original[key] == null) delete process.env[key];
    else process.env[key] = original[key];
  }
});

describe('AI monetary spend protection', () => {
  test('does not invent a plan monetary cap', () => {
    delete process.env.AI_MONTHLY_USD_CAP;
    delete process.env.AI_MONTHLY_USD_CAP_STARTER;
    expect(configuredMonthlyAiCostCap('starter')).toBeNull();
  });

  test('uses a plan-specific owner-approved cap before the global cap', () => {
    process.env.AI_MONTHLY_USD_CAP = '200';
    process.env.AI_MONTHLY_USD_CAP_STARTER = '50';
    expect(configuredMonthlyAiCostCap('starter')).toBe(50);
  });

  test('requires complete input and output provider pricing', () => {
    process.env.OPENAI_INPUT_USD_PER_1M = '2.5';
    delete process.env.OPENAI_OUTPUT_USD_PER_1M;
    expect(configuredAiPricing('openai')).toBeNull();

    process.env.OPENAI_OUTPUT_USD_PER_1M = '10';
    expect(configuredAiPricing('openai')).toEqual({ provider: 'openai', input: 2.5, output: 10 });
  });

  test('estimates a conservative request cost from prompt and maximum output tokens', () => {
    process.env.OPENAI_INPUT_USD_PER_1M = '2';
    process.env.OPENAI_OUTPUT_USD_PER_1M = '8';
    const cost = estimateAiRequestCostUsd([{ role: 'user', content: '12345678' }], 1000, 'openai');
    expect(cost).toBeCloseTo((2 / 1_000_000) * 2 + (1000 / 1_000_000) * 8, 10);
  });

  test('reports implemented-but-unconfigured status truthfully', () => {
    delete process.env.AI_MONTHLY_USD_CAP;
    expect(aiMonetaryCapStatus()).toMatchObject({ implemented: true, configured: false, capUsd: null });
  });
});
