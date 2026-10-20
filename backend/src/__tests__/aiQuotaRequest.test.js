import { describe, expect, test } from '@jest/globals';
import { estimateAiRequestTokens } from '../services/aiUsagePolicy.js';

describe('AI request quota estimation', () => {
  test('reserves prompt plus configured maximum output tokens', () => {
    const messages = [
      { role: 'system', content: 'You are concise.' },
      { role: 'user', content: 'Write a short campaign plan.' },
    ];
    const estimated = estimateAiRequestTokens(messages, 800);
    expect(estimated).toBeGreaterThanOrEqual(800);
  });

  test('never returns a zero-token reservation', () => {
    expect(estimateAiRequestTokens([], 0)).toBe(1);
  });
});
