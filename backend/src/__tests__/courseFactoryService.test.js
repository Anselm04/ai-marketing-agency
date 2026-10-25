import { describe, expect, test } from '@jest/globals';
import {
  buildFallbackCoursePackage,
  normalizeCoursePackage,
  buildCourseProjectKey,
  validateMultipartParts,
} from '../services/courseFactoryService.js';

describe('Course Factory service', () => {
  test('builds a complete evidence-aware fallback package', () => {
    const result = buildFallbackCoursePackage({
      name: 'Master Carving Course',
      targetAudience: 'Beginner to advanced carvers',
      desiredOutcome: 'Complete a finished carving safely and confidently',
      transcript: '[0.00s-20.00s] I am roughing out the outside curve. [20.00s-40.00s] I change to a smaller burr for the inside radius.',
      visualAnalysis: {
        observations: [
          { timestampSeconds: 25, observation: 'Creator changes to a smaller rotary burr.', provenance: { kind: 'ai_inference', reviewRequired: true } },
        ],
      },
    });

    expect(result.title).toBe('Master Carving Course');
    expect(result.modules.length).toBeGreaterThanOrEqual(6);
    expect(result.modules[0].lessons.length).toBeGreaterThan(0);
    expect(result.assets.manual.sections.length).toBeGreaterThan(0);
    expect(result.assets.youtube).toHaveProperty('title');
    expect(result.assets.marketing.emailSequence.length).toBeGreaterThanOrEqual(3);
    expect(result.assets.shortForm.length).toBeGreaterThan(0);
    expect(result.review.required).toBe(true);
    expect(result.provenance.creatorEvidence).toBe(true);
    expect(result.provenance.aiInferenceRequiresReview).toBe(true);
  });

  test('normalizes package so AI-generated safety claims always require review', () => {
    const result = normalizeCoursePackage({
      title: 'Unsafe draft',
      modules: [{
        title: 'Tools',
        lessons: [{ title: 'Safety', safetyNotes: ['Wear PPE'], provenance: { kind: 'ai_generated' } }],
      }],
    }, { name: 'Safe course' });

    expect(result.review.required).toBe(true);
    expect(result.modules[0].lessons[0].provenance.reviewRequired).toBe(true);
  });

  test('builds owner-scoped storage keys and validates multipart completion parts', () => {
    const key = buildCourseProjectKey('owner-123', 'project-456', 'My Waka Huia.mov');
    expect(key).toMatch(/^course-factory\/owner-123\/project-456\//);
    expect(key.endsWith('.mov')).toBe(true);

    expect(validateMultipartParts([
      { partNumber: 2, etag: 'etag-b' },
      { partNumber: 1, etag: 'etag-a' },
    ])).toEqual([
      { PartNumber: 1, ETag: 'etag-a' },
      { PartNumber: 2, ETag: 'etag-b' },
    ]);

    expect(() => validateMultipartParts([{ partNumber: 1, etag: '' }])).toThrow(/etag/i);
  });
});
