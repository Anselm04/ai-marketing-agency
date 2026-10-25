import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';

describe('Course Factory evidence gates', () => {
  let token;

  beforeAll(async () => {
    const email = `course-evidence-${Date.now()}@example.com`;
    const register = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123!',
        firstName: 'Evidence',
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

  test.each(['generate-curriculum', 'generate-package'])(
    'blocks %s until transcript or visual creator evidence exists',
    async (action) => {
      const created = await request(app)
        .post('/api/course-factory/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Evidence-required course',
          rightsManifest: { confirmedOwnership: true, commercialUseAllowed: true },
        });

      const response = await request(app)
        .post(`/api/course-factory/projects/${created.body.id}/${action}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('course_source_evidence_required');
    },
  );
});
