import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';
import clippingAgencyService from '../services/clippingAgencyService.js';
import { jest } from '@jest/globals';

describe('AI Clipping Agency API', () => {
  let token;
  let clipPlanSpy;

  beforeAll(() => {
    // This integration suite verifies campaign routing, scheduling, ownership,
    // and rights enforcement. A deterministic AI result avoids requiring a
    // live third-party model in CI; production remains fail-closed on AI errors.
    clipPlanSpy = jest.spyOn(clippingAgencyService, 'generateClipPlan').mockImplementation(async (input) => ({
      generatedAt: new Date().toISOString(),
      aiFallback: false,
      platforms: input.platforms,
      clips: Array.from({ length: input.maxClips || 6 }, (_, index) => ({
        id: `clip-${index + 1}`,
        title: `Source-backed test clip ${index + 1}`,
        hook: 'The product saves teams time.',
        startSeconds: index * 30,
        endSeconds: (index + 1) * 30,
        durationSeconds: 30,
        platforms: input.platforms,
        caption: 'The product saves teams time.',
        hashtags: [],
        status: 'planned',
        mediaUrl: null,
      })),
    }));
  });

  afterAll(() => {
    clipPlanSpy.mockRestore();
  });

  beforeAll(async () => {
    const email = `clipping-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        acceptedTerms: true,
        password: 'SecurePass123!',
        firstName: 'Clip',
        lastName: 'Tester',
      });
    token = res.body.token;
    const user = await store.findUserByEmail(email);
    await store.createSubscription({
      userId: user.id,
      user: user.id,
      plan: 'starter',
      status: 'active',
      source: 'test',
      expiresAt: null,
    });
  });

  test('creates, plans, rights-gates, activates, and records manual metrics without claiming verified optimization', async () => {
    const createRes = await request(app)
      .post('/api/clipping/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Autonomous Clips',
        brief: 'Turn this founder interview into short clips that explain the product clearly.',
        transcript: 'The product saves teams time. Customers use it to automate repetitive marketing. The strongest result is faster campaign execution.',
        sourceDurationSeconds: 180,
        platforms: ['TikTok', 'YouTube'],
        budget: 10000,
        agencyRate: 0.2,
        maxClips: 4,
        rightsManifest: {
          confirmedOwnership: true,
          commercialUseAllowed: true,
          allowedPlatforms: ['TikTok', 'YouTube'],
          territories: ['worldwide'],
        },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.kind).toBe('ai-clipping');
    expect(createRes.body.economics.agencyRevenue).toBe(2000);
    expect(createRes.body.economics.creatorPool).toBe(8000);

    const id = createRes.body.id;

    const planRes = await request(app)
      .post(`/api/clipping/campaigns/${id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ intervalMinutes: 120 });

    expect(planRes.status).toBe(200);
    expect(planRes.body.status).toBe('planned');
    expect(planRes.body.clipPlan.clips).toHaveLength(4);
    expect(planRes.body.clipPlan.clips[0]).toHaveProperty('scheduledAt');

    const activateRes = await request(app)
      .post(`/api/clipping/campaigns/${id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.status).toBe('running');
    expect(activateRes.body.autonomous.enabled).toBe(true);

    const metricsRes = await request(app)
      .post(`/api/clipping/campaigns/${id}/metrics`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        metrics: [
          { clipId: 'clip-1', views: 10000, clicks: 500, conversions: 25, revenue: 2500 },
          { clipId: 'clip-2', views: 5000, clicks: 150, conversions: 5, revenue: 500 },
        ],
      });

    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.performance).toEqual(expect.arrayContaining([
      expect.objectContaining({ clipId: 'clip-1', views: 10000, clicks: 500, revenue: 2500, provenance: expect.objectContaining({ kind: 'manual_user_entry' }) }),
      expect.objectContaining({ clipId: 'clip-2', views: 5000, clicks: 150, revenue: 500, provenance: expect.objectContaining({ kind: 'manual_user_entry' }) }),
    ]));
    expect(metricsRes.body.optimization.status).toBe('insufficient_verified_data');
    expect(metricsRes.body.optimization.verifiedObservations).toBe(0);
    expect(metricsRes.body.optimization.summary).toBeNull();
    expect(metricsRes.body.optimization.recommendations).toBeNull();
  });

  test('blocks autonomous activation when commercial rights are not confirmed', async () => {
    const createRes = await request(app)
      .post('/api/clipping/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Rights Blocked',
        brief: 'Test campaign',
        platforms: ['TikTok'],
        rightsManifest: {
          confirmedOwnership: false,
          commercialUseAllowed: false,
          allowedPlatforms: ['TikTok'],
        },
      });

    const planRes = await request(app)
      .post(`/api/clipping/campaigns/${createRes.body.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(planRes.status).toBe(200);

    const activateRes = await request(app)
      .post(`/api/clipping/campaigns/${createRes.body.id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(activateRes.status).toBe(409);
    expect(activateRes.body.details.length).toBeGreaterThan(0);
  });
});

