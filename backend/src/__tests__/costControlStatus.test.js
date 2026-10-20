import { describe, test, expect } from '@jest/globals';
import { getAiCostControlStatus } from '../services/aiCostControlStatus.js';

describe('AI cost control status', () => {
  test('does not claim enforcement before durable usage metering exists', () => {
    expect(getAiCostControlStatus()).toEqual({
      enforced: false,
      metering: false,
      reason: 'Per-customer AI usage metering and spend enforcement are not implemented yet.',
    });
  });
});
