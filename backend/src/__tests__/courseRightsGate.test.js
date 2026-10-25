import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';

describe('Course Factory rights gates', () => {
  let token;

  beforeAll(async () => {
    const email = `course-rights-${Date.now()}@example.com`;
    const register = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123!',
        firstName: 'Rights',
        lastName: 'Owner',
        acceptedTerms: true,
      });

    token = register.body.token;
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

  async function createProject() {
    const response = await request(app)
      .post('/api/course-factory/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Rights-gated course',
        rightsManifest: {
          confirmedOwnership: true,
          commercialUseAllowed: true,
        },
      });

    expect(response.status).toBe(201);
    return response.body;
  }

  test('blocks approval when commercial-use rights have expired since generation', async () => {
    const project = await createProject();
    await store.updateCampaign(project.id, {
      curriculum: { title: 'Prepared curriculum', modules: [] },
      rightsManifest: {
        confirmedOwnership: true,
        commercialUseAllowed: true,
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    });

    const response = await request(app)
      .post(`/api/course-factory/projects/${project.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Approve' });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/rights/i);
  });

  test('blocks lesson rendering when approved course rights have expired', async () => {
    const project = await createProject();
    await store.updateCampaign(project.id, {
      approval: {
        humanApprovalRequired: true,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'test-owner',
        notes: '',
      },
      curriculum: {
        title: 'Approved curriculum',
        modules: [{
          title: 'Module 1',
          lessons: [{ title: 'Lesson 1', sourceSegments: [{ startSeconds: 0, endSeconds: 30 }] }],
        }],
      },
      rightsManifest: {
        confirmedOwnership: true,
        commercialUseAllowed: true,
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    });

    const response = await request(app)
      .post(`/api/course-factory/projects/${project.id}/render-lessons`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dryRun: true });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/rights/i);
  });
});
