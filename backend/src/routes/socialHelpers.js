import socialMediaService from '../services/socialMediaService.js';
import store from '../utils/store.js';
import { decryptUtf8 } from '../utils/owner.js';
import { canonicalPlatform } from '../services/spendGuard.js';
import { resolvePlatform } from '../services/oauthPlatforms.js';

export function publicConnection(row) {
  if (!row) return row;
  const { tokenCipher, token, accessToken, secret, ...safe } = row;
  return { ...safe, tokenSet: !!row.tokenSet, charge: 'included' };
}

export function connectorConnected(platform) {
  const c = canonicalPlatform(platform);
  return !!socialMediaService.isAvailable(c) || !!socialMediaService.isAvailable(platform)
    || (c === 'x' && socialMediaService.isAvailable('twitter'));
}

export function userTokenFor(conn) {
  if (!conn?.tokenCipher) return null;
  try { return decryptUtf8(conn.tokenCipher, 'social-token'); }
  catch { return null; }
}

export function tokenKeyForPlatform(platform) {
  const m = resolvePlatform(platform);
  if (m?.tokenKey) return m.tokenKey;
  const c = canonicalPlatform(platform);
  if (c === 'x') return 'twitter';
  if (c === 'meta') return 'metaAds';
  if (c === 'google') return 'googleAds';
  return c;
}

export async function publishWithPreferredToken(uid, platform, content) {
  const mine = await store.getSocialConnectionsByOwner(uid);
  const conn = mine.find((c) => canonicalPlatform(c.platform) === canonicalPlatform(platform));
  const userTok = userTokenFor(conn);
  const key = tokenKeyForPlatform(platform);
  // withUserTokens lives in local socialMediaService.js (MCP size — not on remote yet)
  const canOverride = userTok && typeof socialMediaService.withUserTokens === 'function';
  const svc = canOverride
    ? socialMediaService.withUserTokens({ [key]: userTok, ...(canonicalPlatform(platform) === 'x' ? { twitter: userTok, x: userTok } : {}) })
    : socialMediaService;
  return svc.publishToAll(content);
}

export function honestResult(r) {
  const published = !!(r && r.success && !r.fallback && r.postId && r.postId !== 'placeholder');
  return {
    platform: r?.platform,
    published,
    queued: !published,
    success: published,
    fallback: !published,
    message: published
      ? 'Published via connected connector'
      : (r?.message || 'Not published. No connector token. Copy or queue this post instead.'),
  };
}
