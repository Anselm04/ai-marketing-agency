import request from 'supertest';
import app from '../index.js';

describe('Owner admin and account controls', () => {
  let ownerToken;
  let regularToken;

  beforeAll(async () => {
    const owner = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'anselm.perkins@gmail.com',
        password: 'OwnerSecurePass123!',
        firstName: 'Owner',
        lastName: 'Account',
      });
    ownerToken = owner.body.token;

    const regular = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'regular-owner-test-' + Date.now() + '@example.com',
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
