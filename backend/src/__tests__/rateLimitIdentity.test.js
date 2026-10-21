import { afterEach, describe, expect, test } from '@jest/globals';
import { resolveRateLimitClientKey } from '../middleware/rateLimit.js';

afterEach(() => {
  delete process.env.FLY_APP_NAME;
});

describe('rate limit client identity', () => {
  test('ignores spoofable Fly header outside Fly', () => {
    const req = {
      headers: { 'fly-client-ip': '198.51.100.10' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    expect(resolveRateLimitClientKey(req)).toBe('127.0.0.1');
  });

  test('uses Fly client IP when running inside Fly', () => {
    process.env.FLY_APP_NAME = 'trillionai-marketing';
    const req = {
      headers: { 'fly-client-ip': '198.51.100.10' },
      ip: '10.0.0.2',
      socket: { remoteAddress: '10.0.0.2' },
    };
    expect(resolveRateLimitClientKey(req)).toBe('198.51.100.10');
  });
});
