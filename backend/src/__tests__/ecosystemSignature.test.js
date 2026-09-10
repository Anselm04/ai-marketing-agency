import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import {
  signEcosystemPayload,
  verifyEcosystemRequest,
} from '../services/ecosystemSignature.js';

const ORIGINAL_SECRET = process.env.TRILLION_ECOSYSTEM_SHARED_SECRET;

function requestFor(body, timestamp, signature, source = 'appforge') {
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

describe('AppForge ecosystem signatures', () => {
  beforeEach(() => {
    process.env.TRILLION_ECOSYSTEM_SHARED_SECRET = 'test-ecosystem-secret';
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.TRILLION_ECOSYSTEM_SHARED_SECRET;
    } else {
      process.env.TRILLION_ECOSYSTEM_SHARED_SECRET = ORIGINAL_SECRET;
    }
  });

  test('accepts a current correctly signed AppForge request', () => {
    const body = { source: 'appforge', sourceProjectId: 42 };
    const timestamp = String(Date.now());
    const signature = signEcosystemPayload(
      process.env.TRILLION_ECOSYSTEM_SHARED_SECRET,
      timestamp,
      JSON.stringify(body),
    );

    expect(verifyEcosystemRequest(requestFor(body, timestamp, signature))).toEqual({
      ok: true,
    });
  });

  test('rejects a request after the signed body is changed', () => {
    const original = { source: 'appforge', sourceProjectId: 42 };
    const timestamp = String(Date.now());
    const signature = signEcosystemPayload(
      process.env.TRILLION_ECOSYSTEM_SHARED_SECRET,
      timestamp,
      JSON.stringify(original),
    );
    const tampered = { ...original, sourceProjectId: 99 };

    const result = verifyEcosystemRequest(
      requestFor(tampered, timestamp, signature),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  test('rejects replayed requests outside the freshness window', () => {
    const body = { source: 'appforge', sourceProjectId: 42 };
    const timestamp = String(Date.now() - 6 * 60 * 1000);
    const signature = signEcosystemPayload(
      process.env.TRILLION_ECOSYSTEM_SHARED_SECRET,
      timestamp,
      JSON.stringify(body),
    );

    const result = verifyEcosystemRequest(requestFor(body, timestamp, signature));
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });
});
