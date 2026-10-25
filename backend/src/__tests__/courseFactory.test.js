import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';

describe('Course Factory API', () => {
  let token;
  let otherToken;

  beforeAll(async () => {
    const email = `course-factory-${Date.now()}@example.com`;
    const otherEmail = `course-factory-other-${Date.now()}@example.com`;

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'SecurePass123!', firstName: 'Course', lastName: 'Creator' });
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

    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({ email: otherEmail, password: 'SecurePass123!', firstName: 'Other', lastName: 'Creator' });
    otherToken = otherRes.body.token;
    const otherUser = await store.findUserByEmail(otherEmail);
    await store.createSubscription({
      userId: otherUser.id,
      user: otherUser.id,
      plan: 'starter',
      status: 'active',
      source: 'test',
      expiresAt: null,
    });
  });

  test('creates and lists an owned course project with human approval required', async () => {
    const createRes = await request(app)
      .post('/api/course-factory/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Master Carving Course',
        targetAudience: 'Beginner to advanced carvers',
        desiredOutcome: 'Complete a finished carving safely and confidently',
        skillLevel: 'all-levels',
        rightsManifest: {
          confirmedOwnership: true,
          commercialUseAllowed: true,
        },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.kind).toBe('ai-course-factory');
    expect(createRes.body.status).toBe('draft');
    expect(createRes.body.approval.humanApprovalRequired).toBe(true);
    expect(createRes.body.approval.status).toBe('pending');
    expect(createRes.body.rightsManifest.confirmedOwnership).toBe(true);

    const listRes = await request(app)
      .get('/api/course-factory/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.some((project) => project.id === createRes.body.id)).toBe(true);
  });

  test('prevents another user from reading a course project', async () => {
    const createRes = await request(app)
      .post('/api/course-factory/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Private Expert Course',
        rightsManifest: { confirmedOwnership: true, commercialUseAllowed: true },
      });

    const readRes = await request(app)
      .get(`/api/course-factory/projects/${createRes.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(readRes.status).toBe(404);
  });

  test('blocks processing when ownership or commercial rights are not confirmed', async () => {
    const createRes = await request(app)
      .post('/api/course-factory/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Unverified Course',
        rightsManifest: { confirmedOwnership: false, commercialUseAllowed: false },
      });

    expect(createRes.status).toBe(201);

    const processRes = await request(app)
      .post(`/api/course-factory/projects/${createRes.body.id}/generate-curriculum`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(processRes.status).toBe(409);
    expect(processRes.body.error).toMatch(/rights/i);
  });
});
