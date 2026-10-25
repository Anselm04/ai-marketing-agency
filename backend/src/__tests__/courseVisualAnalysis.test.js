import { describe, expect, test } from '@jest/globals';
import {
  buildSampleTimestamps,
  normalizeVisualObservation,
} from '../services/courseVisualAnalysisService.js';

describe('Course Factory visual analysis', () => {
  test('bounds visual sampling across a long silent source', () => {
    const samples = buildSampleTimestamps(3 * 60 * 60, { intervalSeconds: 120, maxFrames: 40 });
    expect(samples.length).toBeLessThanOrEqual(40);
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBeLessThanOrEqual(3 * 60 * 60);
    expect(samples.every((value, index) => index === 0 || value > samples[index - 1])).toBe(true);
  });

  test('marks machine observations as review-required inference', () => {
    const result = normalizeVisualObservation({
      timestampSeconds: 90,
      observation: 'Creator changes to a smaller rotary tool and works inside a tight curve.',
      stage: 'fine-detail',
      confidence: 0.82,
    });

    expect(result.timestampSeconds).toBe(90);
    expect(result.provenance.kind).toBe('ai_inference');
    expect(result.provenance.reviewRequired).toBe(true);
    expect(result.confidence).toBe(0.82);
  });
});
