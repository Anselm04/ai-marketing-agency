import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';

describe('Course Factory lesson media production API', () => {
  let token;

  beforeAll(async () => {
    const email = `course-media-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, acceptedTerms: true, password: 'SecurePass123!', firstName: 'Media', lastName: 'Creator' });
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

  test('blocks lesson video rendering before creator approval', async () => {
    const created = await request(app)
      .post('/api/course-factory/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Unapproved media course',
        sourceUrl: 'https://cdn.example.com/source.mp4',
        rightsManifest: { confirmedOwnership: true, commercialUseAllowed: true },
      });

    await store.updateCampaign(created.body.id, {
      coursePackage: {
        modules: [{
          id: 'm1',
          title: 'Module',
          lessons: [{
            id: 'l1',
            title: 'Lesson',
            sourceSegments: [{ startSeconds: 0, endSeconds: 60, purpose: 'demo' }],
          }],
        }],
      },
    });

    const res = await request(app)
      .post(`/api/course-factory/projects/${created.body.id}/render-lessons`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/approved/i);
  });

  test('queues approved lesson videos for production', async () => {
    const created = await request(app)
      .post('/api/course-factory/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Approved media course',
        sourceUrl: 'https://cdn.example.com/source.mp4',
        sourceDurationSeconds: 600,
        rightsManifest: { confirmedOwnership: true, commercialUseAllowed: true },
      });

    await store.updateCampaign(created.body.id, {
      approval: { humanApprovalRequired: true, status: 'approved', approvedAt: new Date().toISOString() },
      coursePackage: {
        modules: [{
          id: 'm1',
          title: 'Module',
          lessons: [{
            id: 'l1',
            title: 'Lesson',
            sourceSegments: [{ startSeconds: 0, endSeconds: 60, purpose: 'demo' }],
          }],
        }],
      },
    });

    const res = await request(app)
      .post(`/api/course-factory/projects/${created.body.id}/render-lessons`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dryRun: true });

    expect(res.status).toBe(202);
    expect(res.body.mediaProduction.status).toBe('planned');
    expect(res.body.mediaProduction.renderPlan.lessons).toHaveLength(1);
    expect(res.body.mediaProduction.renderPlan.lessons[0].outputAspect).toBe('16:9');
  });
});
