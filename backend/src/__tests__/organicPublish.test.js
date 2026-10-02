import { buildAuthorizationUrl, resolvePlatform } from '../services/oauthPlatforms.js';
import { honestResult } from '../routes/socialHelpers.js';
import { linkedInPostBody, expiryMs } from '../services/organicPublisher.js';

describe('organic OAuth and publish readiness', () => {
  const keys = [
    'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET',
    'TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET',
    'META_APP_ID', 'META_APP_SECRET', 'META_GRAPH_VERSION',
  ];
  const previous = {};

  beforeAll(() => {
    for (const key of keys) previous[key] = process.env[key];
    process.env.TIKTOK_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_CLIENT_SECRET = 'tt-secret';
    process.env.TWITTER_CLIENT_ID = 'tw-id';
    process.env.TWITTER_CLIENT_SECRET = 'tw-secret';
    process.env.META_APP_ID = 'meta-id';
    process.env.META_APP_SECRET = 'meta-secret';
    process.env.META_GRAPH_VERSION = 'v21.0';
    delete process.env.API_URL;
    delete process.env.PUBLIC_URL;
  });

  afterAll(() => {
    for (const key of keys) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  test('TikTok authorize URL uses client_key, PKCE, and the Fly callback', async () => {
    const built = await buildAuthorizationUrl(resolvePlatform('tiktok'), { userId: 'user-1' });
    const url = new URL(built.authorizationUrl);
    expect(url.searchParams.get('client_key')).toBe('tt-key');
    expect(url.searchParams.has('client_id')).toBe(false);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('scope')).toContain('video.publish');
    expect(url.searchParams.get('scope')).toContain(',');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://trillionai-marketing.fly.dev/api/social/oauth/tiktok/callback',
    );
    expect(String(built.state)).toContain('.');
  });

  test('X authorize URL uses PKCE and the Fly callback', async () => {
    const built = await buildAuthorizationUrl(resolvePlatform('x'), { userId: 'user-1' });
    const url = new URL(built.authorizationUrl);
    expect(url.searchParams.get('client_id')).toBe('tw-id');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://trillionai-marketing.fly.dev/api/social/oauth/x/callback',
    );
  });

  test('Facebook dialog uses META_GRAPH_VERSION instead of retired v18', async () => {
    const built = await buildAuthorizationUrl(resolvePlatform('facebook'), { userId: 'user-1' });
    expect(built.authorizationUrl).toContain('https://www.facebook.com/v21.0/dialog/oauth');
    expect(new URL(built.authorizationUrl).searchParams.get('redirect_uri')).toBe(
      'https://trillionai-marketing.fly.dev/api/social/oauth/facebook/callback',
    );
  });

  test('a TikTok publish id counts as a real post', () => {
    const row = honestResult({ success: true, platform: 'tiktok', publishId: 'pub_123' });
    expect(row.published).toBe(true);
    expect(row.postId).toBe('pub_123');
    expect(row.fallback).toBe(false);
  });

  test('LinkedIn text posts target the member URN', () => {
    const body = linkedInPostBody({ personUrn: 'urn:li:person:abc', text: 'hello' });
    expect(body.author).toBe('urn:li:person:abc');
    expect(body.commentary).toBe('hello');
    expect(JSON.stringify(body)).not.toContain('urn:li:person:me');
  });

  test('token expiry accepts the numeric timestamps we store', () => {
    expect(expiryMs(1700000000000)).toBe(1700000000000);
    expect(expiryMs(null)).toBeNull();
  });
});
