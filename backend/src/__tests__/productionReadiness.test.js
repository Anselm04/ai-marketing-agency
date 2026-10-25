import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { systemHealth } from '../utils/systemHealth.js';
import { POSTGRES_READINESS_SQL } from '../utils/postgresReadiness.js';

const keys = ['OPENAI_API_KEY', 'GROQ_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'SENDGRID_API_KEY', 'AWS_SES_ACCESS_KEY', 'AWS_SES_SECRET_KEY', 'SMTP_HOST'];
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
beforeEach(() => {
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { GROQ_API_KEY: 'test-placeholder', STRIPE_SECRET_KEY: 'test-placeholder', STRIPE_WEBHOOK_SECRET: 'test-placeholder', RESEND_API_KEY: 'test-placeholder' });
});
afterEach(() => {
  for (const key of keys) {
    if (original[key] == null) delete process.env[key];
    else process.env[key] = original[key];
  }
});
const database = () => ({ isPostgres: () => true, connectDB: jest.fn().mockResolvedValue(true), checkReadiness: jest.fn().mockResolvedValue(true) });

describe('production readiness', () => {
  test('requires the application schema in addition to a successful connection', async () => {
    const store = database();
    store.checkReadiness.mockRejectedValue(new Error('required relation missing'));
    const health = await systemHealth(store, true);
    expect(health.status).toBe('degraded');
    expect(health.readiness.database).toBe(false);
    expect(health.database).toBe('unavailable');
  });
  test('accepts an available PostgreSQL schema with configured required services', async () => {
    const store = database();
    const health = await systemHealth(store, true);
    expect(store.checkReadiness).toHaveBeenCalledTimes(1);
    expect(health.status).toBe('ok');
  });
  test.each(['GROQ_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY'])('fails readiness when %s is absent', async (key) => {
    delete process.env[key];
    expect((await systemHealth(database(), true)).status).toBe('degraded');
  });
  test('does not approve local JSON persistence in production', async () => {
    const store = { isPostgres: () => false, connectDB: jest.fn().mockResolvedValue(true) };
    expect((await systemHealth(store, true)).status).toBe('degraded');
  });
  test('schema probes never read customer rows or mutate data', () => {
    const queries = POSTGRES_READINESS_SQL.split(';').map((sql) => sql.trim());
    expect(queries).toHaveLength(23);
    for (const query of queries) expect(query).toMatch(/^select [a-z_, ]+ from (marketing|public)\.[a-z_]+ limit 0$/);
    for (const table of ['users', 'settings', 'usage_events', 'quota_reservations', 'rate_limit_windows']) {
      expect(POSTGRES_READINESS_SQL).toContain(`from marketing.${table} limit 0`);
    }
    expect(POSTGRES_READINESS_SQL).toContain('from public.stripe_webhook_events limit 0');
  });
});
