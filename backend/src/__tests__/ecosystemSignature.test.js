import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  signEcosystemPayload,
  verifyEcosystemRequest,
} from '../services/ecosystemSignature.js';

const originalSecret = process.env.TRILLION_ECOSYSTEM_SHARED_SECRET;

function makeRequest({ body, source = 'appforge', timestamp, signature }) {
  const headers = {
    'x-trillion-source': source,
    'x-trillion-timestamp': timestamp,
    'x-trillion-signature': signature,
  };
  return {
    body,
    get(name) {
      return headers[name.toLowerCase()];
    },
  };
}

describe('Trillion ecosystem request signing', () => {
  beforeEach(() => {
    process.env.TRILLION_ECOSYSTEM_SHARED_SECRET = 'test-ecosystem-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TRILLION_ECOSYSTEM_SHARED_SECRET;
    else process.env.TRILLION_ECOSYSTEM_SHARED_SECRET = originalSecret;
  });

  test('accepts a valid AppForge HMAC request', () => {
    const body = { source: 'appforge', sourceProjectId: 42 };
    const timestamp = String(Date.now());
    const signature = signEcosystemPayload(
      process.env.TRILLION_ECOSYSTEM_SHARED_SECRET,
      timestamp,
      JSON.stringify(body),
    );

    const result = verifyEcosystemRequest(
      makeRequest({ body, timestamp, signature }),
    );

    expect(result.ok).toBe(true);
  });

  test('rejects a request with a modified payload', () => {
    const signedBody = { source: 'appforge', sourceProjectId: 42 };
    const timestamp = String(Date.now());
    const signature = signEcosystemPayload(
      process.env.TRILLION_ECOSYSTEM_SHARED_SECRET,
      timestamp,
      JSON.stringify(signedBody),
    );

    const result = verifyEcosystemRequest(
      makeRequest({
        body: { ...signedBody, sourceProjectId: 43 },
        timestamp,
        signature,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  test('rejects expired signed requests', () => {
    const body = { source: 'appforge', sourceProjectId: 42 };
    const timestamp = String(Date.now() - 10 * 60 * 1000);
    const signature = signEcosystemPayload(
      process.env.TRILLION_ECOSYSTEM_SHARED_SECRET,
      timestamp,
      JSON.stringify(body),
    );

    const result = verifyEcosystemRequest(
      makeRequest({ body, timestamp, signature }),
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });
});
