
import request from 'supertest';
import app from '../index.js';
import autoPostingService, { CADENCE_LIMITS } from '../services/autoPostingService.js';
import { scoreMetrics } from '../services/autoPostingAnalyticsService.js';

describe('Automated posting scheduler', () => {
  let token;

  beforeAll(async () => {
    const email = 'auto-posting-' + Date.now() + '@example.com';
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123!',
        firstName: 'Auto',
        lastName: 'Posting',
      });
    token = res.body.token;
  });

  test('normalizes cadence and enforces posting limits', () => {
    const daily = autoPostingService.normalizePlan({
      cadence: 'daily',
      postsPerPeriod: 999,
      sourceAssetIds: ['a', 'a', 'b'],
      platformIds: ['YouTube', 'youtube'],
      assetsPerPost: 99,
    });

    expect(daily.postsPerPeriod).toBe(CADENCE_LIMITS.daily);
    expect(daily.sourceAssetIds).toEqual(['a', 'b']);
    expect(daily.platformIds).toEqual(['youtube']);
    expect(daily.assetsPerPost).toBe(8);

    const monthly = autoPostingService.normalizePlan({
      cadence: 'monthly',
      postsPerPeriod: 30,
    });
    expect(monthly.postsPerPeriod).toBe(30);
    expect(monthly.intervalMinutes).toBe(1440);
  });

  test('keeps recurring runs inside the user preferred posting window', () => {
    const from = Date.parse('2026-09-25T00:00:00.000Z');
    const plan = autoPostingService.normalizePlan({
      cadence: 'daily',
      postsPerPeriod: 4,
      timezone: 'UTC',
      postingWindowStartHour: 8,
      postingWindowEndHour: 21,
    });
    expect(autoPostingService.nextRunAt(plan, from)).toBe('2026-09-25T08:00:00.000Z');
  });

  test('can favor a learned best hour while remaining inside the allowed window', () => {
    const from = Date.parse('2026-09-25T06:00:00.000Z');
    const plan = autoPostingService.normalizePlan({
      cadence: 'daily',
      postsPerPeriod: 2,
      timezone: 'UTC',
      postingWindowStartHour: 8,
      postingWindowEndHour: 21,
    });
    expect(autoPostingService.nextRunAt(plan, from, [19])).toBe('2026-09-25T19:00:00.000Z');
  });

  test('calculates a performance score from engagement and conversion metrics', () => {
    const low = scoreMetrics({ views: 100, likes: 1, clicks: 1 });
    const high = scoreMetrics({ views: 100, likes: 10, shares: 5, clicks: 10, conversions: 2 });
    expect(high).toBeGreaterThan(low);
  });

  test('exposes cadence limits to authenticated users', async () => {
    const res = await request(app)
      .get('/api/auto-posting/limits')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.cadenceLimits).toEqual(CADENCE_LIMITS);
  });

  test('returns only the current user auto-posting plans', async () => {
    const res = await request(app)
      .get('/api/auto-posting')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
  });

  test('rejects a plan without user-selected media', async () => {
    const res = await request(app)
      .post('/api/auto-posting')
      .set('Authorization', 'Bearer ' + token)
      .send({
        enabled: true,
        cadence: 'weekly',
        postsPerPeriod: 7,
        sourceAssetIds: [],
        platformIds: ['youtube'],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/source photos\/videos/i);
  });
});
