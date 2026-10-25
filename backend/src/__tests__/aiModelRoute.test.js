import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';

describe('AI model detail route', () => {
  let token;

  beforeAll(async () => {
    const email = `ai-model-route-${Date.now()}@example.com`;
    const register = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123!',
        firstName: 'AI',
        lastName: 'Model',
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

  test('requires provider identity when a model id is ambiguous', async () => {
    const response = await request(app)
      .get('/api/ai-models/gpt-4o')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ai_model_provider_required');
    expect(response.body.providers).toEqual(expect.arrayContaining(['openai', 'azure']));
  });

  test('returns the exact provider model when providerId is specified', async () => {
    const response = await request(app)
      .get('/api/ai-models/gpt-4o?providerId=openai')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.model.providerId).toBe('openai');
    expect(typeof response.body.model.available).toBe('boolean');
  });
});
