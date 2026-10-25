import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';

describe('Owner admin and account controls', () => {
  let ownerToken;
  let regularToken;

  beforeAll(async () => {
    // The operator provisions privileged identities; public signup must never grant ownership.
    await store.createUser({
      email: 'anselm.perkins@gmail.com',
      password: 'OwnerSecurePass123!',
      profile: { firstName: 'Owner', lastName: 'Account' },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'anselm.perkins@gmail.com', password: 'OwnerSecurePass123!' });
    expect(login.status).toBe(200);
    ownerToken = login.body.token;

    const regular = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'regular-owner-test-' + Date.now() + '@example.com',
        acceptedTerms: true,
        password: 'RegularSecurePass123!',
        firstName: 'Regular',
        lastName: 'User',
      });
    regularToken = regular.body.token;
  });

  test('regular users cannot access the owner god-code generator', async () => {
    const res = await request(app)
      .post('/api/admin/god-codes')
      .set('Authorization', 'Bearer ' + regularToken)
      .send({ sku: 'enterprise' });

    expect(res.status).toBe(403);
  });

  test('owner email can mint and redeem a code from the owner-protected admin endpoint', async () => {
    const mint = await request(app)
      .post('/api/admin/god-codes')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({ sku: 'enterprise' });

    expect(mint.status).toBe(201);
    expect(mint.body.code).toMatch(/^TM-/);
    expect(mint.body.sku).toBe('enterprise');

    const redeem = await request(app)
      .post('/api/admin/god-codes/redeem-owner')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({ code: mint.body.code });

    expect(redeem.status).toBe(200);
    expect(redeem.body.success).toBe(true);
    expect(redeem.body.subscription.plan).toBe('enterprise');
    expect(redeem.body.subscription.unlimited).toBe(true);
  });

  test('owner can mint timed personal-access god codes with a duration slider value', async () => {
    const mint = await request(app)
      .post('/api/admin/god-codes')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({
        sku: 'growth',
        accessMode: 'timed',
        durationDays: 30,
      });

    expect(mint.status).toBe(201);
    expect(mint.body.accessMode).toBe('timed');
    expect(mint.body.durationDays).toBe(30);

    const before = Date.now();
    const redeem = await request(app)
      .post('/api/admin/god-codes/redeem-owner')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({ code: mint.body.code });

    expect(redeem.status).toBe(200);
    expect(redeem.body.accessMode).toBe('timed');
    expect(redeem.body.durationDays).toBe(30);
    expect(redeem.body.subscription.lifetimeAccess).toBe(false);
    expect(redeem.body.subscription.expiresAt).toBeTruthy();

    const expiry = new Date(redeem.body.subscription.expiresAt).getTime();
    const expected = before + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiry - expected)).toBeLessThan(10_000);
  });

  test('owner can mint lifetime-access god codes with no expiry', async () => {
    const mint = await request(app)
      .post('/api/admin/god-codes')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({
        sku: 'agency',
        accessMode: 'lifetime',
      });

    expect(mint.status).toBe(201);
    expect(mint.body.accessMode).toBe('lifetime');
    expect(mint.body.durationDays).toBeNull();

    const redeem = await request(app)
      .post('/api/admin/god-codes/redeem-owner')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({ code: mint.body.code });

    expect(redeem.status).toBe(200);
    expect(redeem.body.subscription.lifetimeAccess).toBe(true);
    expect(redeem.body.subscription.expiresAt).toBeNull();
  });

  test('rejects invalid timed access durations', async () => {
    const res = await request(app)
      .post('/api/admin/god-codes')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({
        sku: 'starter',
        accessMode: 'timed',
        durationDays: 366,
      });

    expect(res.status).toBe(400);
  });

  test('simultaneous redemption attempts have exactly one winner', async () => {
    const mint = await request(app)
      .post('/api/admin/god-codes')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({ sku: 'starter', accessMode: 'lifetime' });

    const [first, second] = await Promise.all([
      request(app)
        .post('/api/admin/god-codes/redeem-owner')
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ code: mint.body.code }),
      request(app)
        .post('/api/admin/god-codes/redeem-owner')
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ code: mint.body.code }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 400]);
  });

  test('god codes remain one-use after owner redemption', async () => {
    const mint = await request(app)
      .post('/api/admin/god-codes')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({ sku: 'credits_100' });

    const first = await request(app)
      .post('/api/admin/god-codes/redeem-owner')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({ code: mint.body.code });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/admin/god-codes/redeem-owner')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({ code: mint.body.code });
    expect(second.status).toBe(400);
  });
});

