import request from 'supertest';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import app from '../index.js';
import store from '../utils/store.js';
import express from 'express';
import { mountHealthRoutes, systemHealth } from '../utils/systemHealth.js';

const healthApp = () => {
  const instance = express();
  mountHealthRoutes(instance, store);
  return instance;
};

afterEach(() => jest.restoreAllMocks());

describe('system health boundaries', () => {
  test('readiness returns machine-readable state instead of the SPA', async () => {
    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.status).toBe('ready');
  });

  test('production readiness includes durable infrastructure and cost-control gates', async () => {
    const productionStore = {
      isPostgres: () => true,
      connectDB: async () => true,
      checkReadiness: async () => true,
      getPersistenceInfo: () => ({ mode: 'supabase-postgres' }),
    };
    const health = await systemHealth(productionStore, true);
    expect(health.readiness.database).toBe(true);
    expect(health.readiness).toEqual(expect.objectContaining({
      durableQueueConfigured: expect.any(Boolean),
      durableQueueReachable: expect.any(Boolean),
      objectStorageConfigured: expect.any(Boolean),
      courseFactoryStorageQuotaConfigured: expect.any(Boolean),
      aiMonetaryCapConfigured: expect.any(Boolean),
      aiPricingConfigured: expect.any(Boolean),
    }));
    expect(health.status).toBe('degraded');
  });

  test('liveness remains available when the database cannot serve requests', async () => {
    jest.spyOn(store, 'connectDB').mockRejectedValue(new Error('Database connection failed'));
    const response = await request(app).get('/live');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('alive');
  });

  test('concurrent public probes share one check and briefly reuse its result', async () => {
    const check = jest.spyOn(store, 'connectDB').mockResolvedValue(true);
    const instance = healthApp();
    await Promise.all(['/ready', '/health', '/api/health'].map((path) => request(instance).get(path)));
    expect(check).toHaveBeenCalledTimes(1);
    await request(instance).get('/ready');
    expect(check).toHaveBeenCalledTimes(1);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 6000);
    await request(instance).get('/ready');
    expect(check).toHaveBeenCalledTimes(2);
  });

  test.each(['/ready', '/health', '/api/health'])('%s rejects unavailable persistence', async (path) => {
    jest.spyOn(store, 'connectDB').mockRejectedValue(new Error('private database diagnostic'));
    const response = await request(healthApp()).get(path);
    expect(response.status).toBe(503);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(JSON.stringify(response.body)).not.toContain('private database diagnostic');
  });
});
