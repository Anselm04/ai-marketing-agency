import { describe, expect, test } from '@jest/globals';
import {
  buildLessonRenderPlan,
  normalizeSourceSegments,
} from '../services/courseMediaProductionService.js';

describe('Course Factory media production', () => {
  test('normalizes and bounds lesson source segments', () => {
    const segments = normalizeSourceSegments([
      { startSeconds: 320, endSeconds: 410, purpose: 'detail work' },
      { startSeconds: 20, endSeconds: 120, purpose: 'rough shaping' },
      { startSeconds: -20, endSeconds: 10, purpose: 'intro' },
    ], 600);

    expect(segments).toEqual([
      { startSeconds: 0, endSeconds: 10, purpose: 'intro' },
      { startSeconds: 20, endSeconds: 120, purpose: 'rough shaping' },
      { startSeconds: 320, endSeconds: 410, purpose: 'detail work' },
    ]);
  });

  test('builds a render plan from approved course lessons', () => {
    const plan = buildLessonRenderPlan({
      id: 'course-1',
      sourceUrl: 'https://cdn.example.com/source.mp4',
      sourceDurationSeconds: 3600,
      approval: { status: 'approved' },
      coursePackage: {
        modules: [{
          id: 'module-1',
          title: 'Rough shaping',
          lessons: [{
            id: 'lesson-1',
            title: 'Establishing the form',
            sourceSegments: [
              { startSeconds: 120, endSeconds: 240, purpose: 'demonstration' },
              { startSeconds: 300, endSeconds: 360, purpose: 'inspection' },
            ],
          }],
        }],
      },
    });

    expect(plan.lessons).toHaveLength(1);
    expect(plan.lessons[0].durationSeconds).toBe(180);
    expect(plan.lessons[0].outputAspect).toBe('16:9');
    expect(plan.lessons[0].segments).toHaveLength(2);
  });

  test('partitions the source across lessons when AI has no trustworthy timestamps yet', () => {
    const plan = buildLessonRenderPlan({
      id: 'course-partition',
      sourceUrl: 'https://cdn.example.com/source.mp4',
      sourceDurationSeconds: 1200,
      approval: { status: 'approved' },
      coursePackage: {
        modules: [
          { id: 'm1', title: 'First', lessons: [{ id: 'l1', title: 'First lesson', sourceEvidence: [] }] },
          { id: 'm2', title: 'Second', lessons: [{ id: 'l2', title: 'Second lesson', sourceEvidence: [] }] },
        ],
      },
    });

    expect(plan.lessons).toHaveLength(2);
    expect(plan.lessons[0].segments[0]).toEqual({ startSeconds: 0, endSeconds: 600, purpose: 'automatic source partition — creator review required' });
    expect(plan.lessons[1].segments[0]).toEqual({ startSeconds: 600, endSeconds: 1200, purpose: 'automatic source partition — creator review required' });
    expect(plan.reviewRequired).toBe(true);
  });

  test('refuses to render unapproved AI course structure', () => {
    expect(() => buildLessonRenderPlan({
      id: 'course-2',
      sourceUrl: 'https://cdn.example.com/source.mp4',
      approval: { status: 'pending' },
      coursePackage: { modules: [] },
    })).toThrow(/approved/i);
  });
});
