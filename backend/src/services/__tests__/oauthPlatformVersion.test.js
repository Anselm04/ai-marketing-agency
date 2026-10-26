import { afterEach, describe, expect, test } from '@jest/globals';
import { getConnectorById } from '../connectors/index.js';
import { metaGraphVersion } from '../oauthPlatforms.js';

const originalMetaVersion = process.env.META_GRAPH_VERSION;

afterEach(() => {
  if (originalMetaVersion == null) delete process.env.META_GRAPH_VERSION;
  else process.env.META_GRAPH_VERSION = originalMetaVersion;
});

describe('current Meta OAuth/API versioning', () => {
  test('defaults social OAuth to Meta Graph v26.0', () => {
    delete process.env.META_GRAPH_VERSION;
    expect(metaGraphVersion()).toBe('v26.0');
  });

  test('rejects malformed Meta version overrides instead of building invalid URLs', () => {
    process.env.META_GRAPH_VERSION = 'latest';
    expect(metaGraphVersion()).toBe('v26.0');
  });

  test('registry normalizes Facebook, Instagram and Meta Ads to v26.0', () => {
    for (const id of ['meta_facebook', 'meta_instagram', 'meta_ads']) {
      const connector = getConnectorById(id);
      expect(connector.baseUrl).toContain('/v26.0');
      expect(connector.auth.authorizationUrl).toContain('/v26.0/');
      expect(connector.auth.tokenUrl).toContain('/v26.0/');
    }
  });

  test('registry targets the current Google Ads v26 API', () => {
    const connector = getConnectorById('google_ads');
    expect(connector.baseUrl).toBe('https://googleads.googleapis.com/v26');
  });
});
