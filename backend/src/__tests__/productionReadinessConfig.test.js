import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, test } from '@jest/globals';
import { fileURLToPath } from 'url';
import { courseFactoryStorageQuotaConfigStatus } from '../services/courseFactoryStorageQuotaService.js';

const originalDefault = process.env.COURSE_FACTORY_STORAGE_GIB_DEFAULT;
const originalPlans = Object.fromEntries(
  ['STARTER', 'GROWTH', 'AGENCY', 'ENTERPRISE'].map((plan) => [
    plan,
    process.env[`COURSE_FACTORY_STORAGE_GIB_${plan}`],
  ]),
);

function restoreEnv(name, value) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv('COURSE_FACTORY_STORAGE_GIB_DEFAULT', originalDefault);
  for (const [plan, value] of Object.entries(originalPlans)) {
    restoreEnv(`COURSE_FACTORY_STORAGE_GIB_${plan}`, value);
  }
});

describe('production readiness configuration', () => {
  test('Course Factory storage readiness requires every commercial plan or a valid default', () => {
    delete process.env.COURSE_FACTORY_STORAGE_GIB_DEFAULT;
    for (const plan of Object.keys(originalPlans)) delete process.env[`COURSE_FACTORY_STORAGE_GIB_${plan}`];

    expect(courseFactoryStorageQuotaConfigStatus()).toMatchObject({
      configured: false,
      configuredPlans: [],
      missingPlans: ['starter', 'growth', 'agency', 'enterprise'],
    });

    process.env.COURSE_FACTORY_STORAGE_GIB_DEFAULT = '25';
    expect(courseFactoryStorageQuotaConfigStatus()).toMatchObject({
      configured: true,
      defaultConfigured: true,
      missingPlans: [],
    });
  });

  test('invalid storage limits are not treated as production-ready', () => {
    process.env.COURSE_FACTORY_STORAGE_GIB_DEFAULT = '0';
    for (const plan of Object.keys(originalPlans)) delete process.env[`COURSE_FACTORY_STORAGE_GIB_${plan}`];
    expect(courseFactoryStorageQuotaConfigStatus().configured).toBe(false);
  });

  test('Fly production config enables Redis queues and forbids memory fallback', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const flyToml = fs.readFileSync(path.resolve(here, '../../../fly.toml'), 'utf8');
    expect(flyToml).toMatch(/USE_REDIS_QUEUE\s*=\s*"true"/);
    expect(flyToml).toMatch(/QUEUE_MEMORY_FALLBACK\s*=\s*"false"/);
    expect(flyToml).not.toMatch(/USE_REDIS_QUEUE\s*=\s*"false"/);
  });
});
