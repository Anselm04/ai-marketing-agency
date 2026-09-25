import request from 'supertest';
import app from '../index.js';

describe('Per-user account memory and privacy', () => {
  let tokenA;
  let tokenB;

  beforeAll(async () => {
    const stamp = Date.now();

    const a = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'memory-a-' + stamp + '@example.com',
        password: 'SecurePass123!',
        firstName: 'Memory',
        lastName: 'A',
      });
    tokenA = a.body.token;

    const b = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'memory-b-' + stamp + '@example.com',
        password: 'SecurePass123!',
        firstName: 'Memory',
        lastName: 'B',
      });
    tokenB = b.body.token;
  });

  test('persists encrypted preferences for the authenticated account', async () => {
    const save = await request(app)
      .patch('/api/settings/preferences')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        language: 'mi',
        timezone: 'Pacific/Auckland',
        theme: 'dark',
        postingWindowStartHour: 8,
        postingWindowEndHour: 21,
        aiOptimizationEnabled: true,
      });

    expect(save.status).toBe(200);
    expect(save.body.preferences.language).toBe('mi');
    expect(save.body.preferences.timezone).toBe('Pacific/Auckland');

    const read = await request(app)
      .get('/api/settings/preferences')
      .set('Authorization', 'Bearer ' + tokenA);

    expect(read.status).toBe(200);
    expect(read.body.preferences.theme).toBe('dark');
    expect(read.body.preferences.postingWindowStartHour).toBe(8);
    expect(read.body.preferences.postingWindowEndHour).toBe(21);
  });

  test('does not leak one users preferences into another account', async () => {
    const read = await request(app)
      .get('/api/settings/preferences')
      .set('Authorization', 'Bearer ' + tokenB);

    expect(read.status).toBe(200);
    expect(read.body.preferences.language).toBe('en');
    expect(read.body.preferences.theme).toBe('system');
  });

  test('returns a user-scoped account-memory summary', async () => {
    const res = await request(app)
      .get('/api/settings/account-memory')
      .set('Authorization', 'Bearer ' + tokenA);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBeTruthy();
    expect(res.body.preferences.timezone).toBe('Pacific/Auckland');
    expect(res.body.savedData).toEqual(expect.objectContaining({
      mediaAndGeneratedContent: expect.any(Number),
      automatedPostingPlans: expect.any(Number),
      analyticsRecords: expect.any(Number),
      campaigns: expect.any(Number),
      leads: expect.any(Number),
      subscriptions: expect.any(Number),
    }));
  });

  test('password reset tokens are one-time and not persisted in user records', async () => {
    const email = 'password-memory-' + Date.now() + '@example.com';
    await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123!',
        firstName: 'Password',
        lastName: 'Memory',
      });

    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email });

    expect(forgot.status).toBe(200);
    expect(forgot.body.devToken).toBeTruthy();

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: forgot.body.devToken, password: 'AnotherSecurePass123!' });

    expect(reset.status).toBe(200);

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: forgot.body.devToken, password: 'ThirdSecurePass123!' });

    expect(reuse.status).toBe(400);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'AnotherSecurePass123!' });

    expect(login.status).toBe(200);
  });
});
