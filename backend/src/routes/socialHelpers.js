import '../services/withUserTokensPatch.js';
import socialMediaService from '../services/socialMediaService.js';
import store from '../utils/store.js';
import { decryptUtf8 } from '../utils/owner.js';
import { canonicalPlatform } from '../services/spendGuard.js';
import { resolvePlatform } from '../services/oauthPlatforms.js';
import { publishOrganic } from '../services/organicPublisher.js';

const ORGANIC_PUBLISH = new Set(['x', 'tiktok', 'instagram', 'facebook', 'linkedin', 'youtube']);

export function publicConnection(row) {
  if (!row) return row;
  const { tokenCipher, token, accessToken, secret, pageAccessToken, ...safe } = row;
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
  const canonical = canonicalPlatform(platform);
  const mine = await store.getSocialConnectionsByOwner(uid);
  const conn = mine.find((c) => canonicalPlatform(c.platform) === canonical);
  const userTok = userTokenFor(conn);
  if (ORGANIC_PUBLISH.has(canonical)) {
    const result = await publishOrganic({
      userId: uid,
      platform: canonical,
      content,
      pastedToken: userTok,
    });
    return [result];
  }
  const key = tokenKeyForPlatform(platform);
  const canOverride = userTok && typeof socialMediaService.withUserTokens === 'function';
  const svc = canOverride
    ? socialMediaService.withUserTokens({ [key]: userTok, ...(canonical === 'x' ? { twitter: userTok, x: userTok } : {}) })
    : socialMediaService;
  return svc.publishToAll(content);
}

export function honestResult(r) {
  const postId = r?.postId || r?.publishId || null;
  const published = !!(r && r.success && !r.fallback && !r.blocked && postId && postId !== 'placeholder');
  return {
    platform: r?.platform,
    published,
    queued: !published,
    queueMode: published ? null : 'manual',
    automaticPublishing: false,
    success: published,
    fallback: !published,
    blocked: !!r?.blocked,
    postId: postId || undefined,
    publishId: r?.publishId,
    message: published
      ? (r?.message || 'Published via connected account')
      : (r?.error || r?.message || 'Not published. No connector token. Copy or queue this post instead.'),
  };
}

