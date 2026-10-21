import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, test } from '@jest/globals';
import authRoutes from '../routes/auth.js';

const EMAIL_ENV_KEYS = [
  'RESEND_API_KEY',
  'SENDGRID_API_KEY',
  'AWS_SES_ACCESS_KEY',
  'AWS_SES_SECRET_KEY',
  'SMTP_HOST',
];

describe('password reset delivery truthfulness', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originals = Object.fromEntries(EMAIL_ENV_KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    for (const key of EMAIL_ENV_KEYS) {
      if (originals[key] == null) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });

  test('returns service unavailable in production when no email transport can deliver reset links', async () => {
    process.env.NODE_ENV = 'production';
    for (const key of EMAIL_ENV_KEYS) delete process.env[key];

    const app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);

    const response = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'anyone@example.com' });

    expect(response.status).toBe(503);
    expect(response.body).toEqual(expect.objectContaining({
      code: 'password_reset_email_unavailable',
    }));
  });
});
