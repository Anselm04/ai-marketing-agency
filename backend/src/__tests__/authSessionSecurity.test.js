import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, jest, test } from '@jest/globals';
import authRoutes from '../routes/auth.js';
import { authenticate } from '../middleware/auth.js';
import store from '../utils/store.js';
import { canonicalOwnerEmail } from '../utils/owner.js';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.get('/protected', authenticate, (_req, res) => res.json({ ok: true }));

describe('account security boundaries', () => {
  test('concurrent use of a reset capability has exactly one winner', async () => {
    const user = await store.createUser({ email: `reset-race-${crypto.randomUUID()}@example.com`, password: 'InitialSecurePass123!' });
    const resetToken = crypto.randomBytes(32).toString('hex');
    await store.setSettings(`password_reset:${crypto.createHash('sha256').update(resetToken).digest('hex')}`, {
      userId: user.id, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const getSetting = store.getSetting.bind(store);
    let reads = 0;
    let release;
    const overlap = new Promise((resolve) => { release = resolve; });
    const lookup = jest.spyOn(store, 'getSetting').mockImplementation(async (key) => {
      const value = await getSetting(key);
      if (key.startsWith('password_reset:')) {
        reads += 1;
        if (reads === 2) release();
        await overlap;
      }
      return value;
    });
    try {
      const responses = await Promise.all([
        request(app).post('/auth/reset-password').send({ token: resetToken, password: 'FirstSecurePass123!' }),
        request(app).post('/auth/reset-password').send({ token: resetToken, password: 'SecondSecurePass123!' }),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    } finally {
      lookup.mockRestore();
    }
  });
  test('a login checked against pre-reset credentials cannot acquire a post-reset session', async () => {
    const email = `racing-login-${crypto.randomUUID()}@example.com`;
    const user = await store.createUser({ email, password: 'OldSecurePass123!' });
    const compare = store.comparePassword.bind(store);
    const comparison = jest.spyOn(store, 'comparePassword').mockImplementation(async (password, hash) => {
      const matches = await compare(password, hash);
      await store.setUserPassword(user.id, 'ResetSecurePass123!');
      return matches;
    });
    try {
      const response = await request(app).post('/auth/login').send({ email, password: 'OldSecurePass123!' });
      expect(response.status).toBe(401);
      expect(response.body.token).toBeUndefined();
    } finally {
      comparison.mockRestore();
    }
  });
  test.each([canonicalOwnerEmail(), `  ${canonicalOwnerEmail().toUpperCase()}  `])('reserves privileged signup identity %s', async (email) => {
    const response = await request(app).post('/auth/register').send({ email, password: 'SecurePass123!', acceptedTerms: true });
    expect(response.status).toBe(403);
    expect(response.body.token).toBeUndefined();
  });

  test('password reset revokes prior sessions while preserving new login and ordinary profile changes', async () => {
    const email = `session-${crypto.randomUUID()}@example.com`;
    const registered = await request(app).post('/auth/register').send({ email, password: 'SecurePass123!', acceptedTerms: true });
    expect(registered.status).toBe(201);
    const token = registered.body.token;
    expect((await request(app).get('/protected').auth(token, { type: 'bearer' })).status).toBe(200);
    const user = await store.findUserByEmail(email);
    await store.updateUser(user.id, { profile: { ...user.profile, company: 'Updated company' } });
    expect((await request(app).get('/auth/me').auth(token, { type: 'bearer' })).status).toBe(200);
    const resetToken = crypto.randomBytes(32).toString('hex');
    await store.setSettings(`password_reset:${crypto.createHash('sha256').update(resetToken).digest('hex')}`, {
      userId: user.id, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect((await request(app).post('/auth/reset-password').send({ token: resetToken, password: 'NewSecurePass123!' })).status).toBe(200);
    expect((await request(app).get('/protected').auth(token, { type: 'bearer' })).status).toBe(401);
    expect((await request(app).get('/auth/me').auth(token, { type: 'bearer' })).status).toBe(401);
    const login = await request(app).post('/auth/login').send({ email, password: 'NewSecurePass123!' });
    expect(login.status).toBe(200);
    expect((await request(app).get('/protected').auth(login.body.token, { type: 'bearer' })).status).toBe(200);
    expect((await request(app).post('/auth/reset-password').send({ token: resetToken, password: 'AnotherSecurePass123!' })).status).toBe(400);
    const legacy = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    expect((await request(app).get('/protected').auth(legacy, { type: 'bearer' })).status).toBe(401);
  });
});
