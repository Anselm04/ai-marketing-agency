import express from 'express';
import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import socialMediaService from '../services/socialMediaService.js';
import { generatePlatformCopy, MAJOR_SOCIALS, buildSchedule } from '../services/marketingEngine.js';
import { ORGANIC_PLATFORMS, ORGANIC_NETWORKS, ORGANIC_NETWORK_LABELS, canonicalPlatform, networkOf, CONTENT_TYPES, contentTypesOf } from '../services/spendGuard.js';
import { encryptUtf8, decryptUtf8 } from '../utils/owner.js';
import {
  PRIORITY_OAUTH_PLATFORMS,
  resolvePlatform,
  isOAuthConfigured,
  getClientCredentials,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  publicFrontendBase,
  socialOAuthCallbackUrl,
} from '../services/oauthPlatforms.js';
import { storeTokens } from '../services/appConnector.js';
import { logger } from '../utils/logger.js';

export function mountSocialPart1(router) {
function publicConnection(row) {
  if (!row) return row;
  const { tokenCipher, token, accessToken, secret, ...safe } = row;
  return { ...safe, tokenSet: !!row.tokenSet, charge: 'included' };
}

function connectorConnected(platform) {
  const c = canonicalPlatform(platform);
  return !!socialMediaService.isAvailable(c) || !!socialMediaService.isAvailable(platform)
    || (c === 'x' && socialMediaService.isAvailable('twitter'));
}


function userTokenFor(conn) {
  if (!conn?.tokenCipher) return null;
  try { return decryptUtf8(conn.tokenCipher, 'social-token'); }
  catch { return null; }
}

function tokenKeyForPlatform(platform) {
  const m = resolvePlatform(platform);
  if (m?.tokenKey) return m.tokenKey;
  const c = canonicalPlatform(platform);
  if (c === 'x') return 'twitter';
  if (c === 'meta') return 'metaAds';
  if (c === 'google') return 'googleAds';
  return c;
}

async function publishWithPreferredToken(uid, platform, content) {
  const mine = await store.getSocialConnectionsByOwner(uid);
  const conn = mine.find((c) => canonicalPlatform(c.platform) === canonicalPlatform(platform));
  const userTok = userTokenFor(conn);
  const key = tokenKeyForPlatform(platform);
  const svc = userTok
    ? socialMediaService.withUserTokens({ [key]: userTok, ...(canonicalPlatform(platform) === 'x' ? { twitter: userTok, x: userTok } : {}) })
    : socialMediaService;
  return svc.publishToAll(content);
}

function honestResult(r) {
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



router.get('/oauth/status', async (req, res) => {
  const uid = userIdOf(req);
  const mine = await store.getSocialConnectionsByOwner(uid);
  const byPlat = Object.fromEntries(mine.map((c) => [canonicalPlatform(c.platform), c]));
  const platforms = PRIORITY_OAUTH_PLATFORMS.map((m) => {
    const configured = isOAuthConfigured(m);
    const creds = getClientCredentials(m);
    const conn = byPlat[m.platform];
    const connected = !!(conn?.tokenSet && conn?.status === 'ready');
    return {
      platform: m.platform,
      label: m.label,
      kind: m.kind,
      connectorId: m.connectorId,
      oauthConfigured: configured,
      connected,
      setup: !!conn,
      tokenSet: !!conn?.tokenSet,
      envKeys: configured ? undefined : creds.envKeys, // admin/debug only — UI must not display raw keys
      setupHint: configured
        ? null
        : 'This platform is not configured by your admin yet. You can generate and copy posts; live Connect needs admin setup or a pasted token.',
    };
  });
  res.json({
    success: true,
    apiBase: process.env.API_URL || process.env.PUBLIC_URL || 'https://trillionai-marketing.fly.dev',
    frontendBase: publicFrontendBase(),
    platforms,
  });
});

router.get('/oauth/:platform/start', async (req, res) => {
  const uid = userIdOf(req);
  const mapping = resolvePlatform(req.params.platform);
  if (!mapping) {
    return res.status(404).json({ error: 'Unknown OAuth platform', platform: req.params.platform });
  }
  if (!isOAuthConfigured(mapping)) {
    const creds = getClientCredentials(mapping);
    return res.status(400).json({
      error: `OAuth app credentials missing for ${mapping.label}`,
      needsConfig: true,
      envKeys: creds.envKeys,
      oauthConfigured: false,
      platform: mapping.platform,
      connectorId: mapping.connectorId,
    });
  }
  try {
    const built = buildAuthorizationUrl(mapping, { userId: uid });
    res.json({
      success: true,
      authorizationUrl: built.authorizationUrl,
      platform: mapping.platform,
      connectorId: mapping.connectorId,
      scopes: built.scopes,
      redirectUri: built.redirectUri,
      oauthConfigured: true,
    });
  } catch (err) {
    if (err.needsConfig || err.code === 'NEEDS_CONFIG') {
      return res.status(400).json({
        error: err.message,
        needsConfig: true,
        envKeys: err.envKeys || getClientCredentials(mapping).envKeys,
        oauthConfigured: false,
      });
    }
    logger.error('OAuth start failed', { error: err.message, platform: mapping.platform });
    res.status(500).json({ error: 'Could not start OAuth', detail: err.message });
  }
});

/** Provider redirect — no Bearer required (exempted in index.js). */
router.get('/oauth/:platform/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  const mapping = resolvePlatform(req.params.platform);
  const frontend = publicFrontendBase();
  if (error) {
    return res.redirect(`${frontend}/social?oauth_error=${encodeURIComponent(String(errorDescription || error))}`);
  }
  if (!mapping || !code || !state) {
    return res.redirect(`${frontend}/social?oauth_error=${encodeURIComponent('invalid_callback')}`);
  }
  try {
    const parsed = JSON.parse(Buffer.from(String(state), 'base64url').toString());
    const userId = parsed.userId;
    if (!userId) throw new Error('Missing userId in state');
    if (parsed.platform && parsed.platform !== mapping.platform) {
      throw new Error('Platform mismatch in OAuth state');
    }
    const tokens = await exchangeAuthorizationCode(mapping, {
      code: String(code),
      state: String(state),
      redirectUri: socialOAuthCallbackUrl(mapping.platform),
    });
    await storeTokens(userId, mapping.connectorId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });
    let tokenCipher = null;
    try { tokenCipher = encryptUtf8(String(tokens.accessToken), 'social-token'); } catch { /* JWT_SECRET required */ }
    store.upsertSocialConnection(userId, mapping.platform, {
      tokenSet: true,
      status: 'ready',
      tokenCipher: tokenCipher || undefined,
      connectorId: mapping.connectorId,
      label: mapping.label,
      note: 'Connected via OAuth. Token stored encrypted; value not returned.',
    });
    logger.info('Social OAuth connected', { userId, platform: mapping.platform, connectorId: mapping.connectorId });
    return res.redirect(`${frontend}/social?connected=${encodeURIComponent(mapping.platform)}`);
  } catch (err) {
    logger.error('Social OAuth callback failed', { error: err.message, platform: mapping?.platform });
    return res.redirect(`${frontend}/social?oauth_error=${encodeURIComponent(err.message || 'oauth_failed')}`);
  }
});

router.get('/networks', (req, res) => {
  res.json({
    included: true,
    charge: 'included',
    paidAdsSeparate: true,
    labels: ORGANIC_NETWORK_LABELS,
    platforms: ORGANIC_NETWORKS.map((n) => ({
      ...n,
      contentTypes: CONTENT_TYPES[n.id] || [],
    })),
  });
});

router.get('/status', async (req, res) => {
  const uid = userIdOf(req);
  const mine = await store.getSocialConnectionsByOwner(uid);
  const byPlat = Object.fromEntries(mine.map((c) => [canonicalPlatform(c.platform), c]));
  const status = await socialMediaService.getAllPlatformStatus();
  const seen = new Set();
  const merged = [];
  for (const p of status) {
    const id = canonicalPlatform(p.platform);
    if (seen.has(id)) continue;
    seen.add(id);
    const net = networkOf(id);
    merged.push({
      platform: id,
      name: net?.name || p.name,
      category: net?.category || p.category || 'Social',
      connected: !!p.connected,
    });
  }
  for (const net of ORGANIC_NETWORKS) {
    if (seen.has(net.id)) continue;
    seen.add(net.id);
    merged.push({ platform: net.id, name: net.name, category: net.category, connected: false });
  }
  res.json(merged.map((p) => {
    const c = byPlat[p.platform];
    const token = !!p.connected || !!c?.tokenSet;
    return {
      ...p,
      connected: token,
      organic: ORGANIC_PLATFORMS.includes(p.platform),
      setup: !!c,
      tokenSet: token,
      charge: ORGANIC_PLATFORMS.includes(p.platform) ? 'included' : (p.category === 'Ads' ? 'paid-addon' : 'optional'),
    };
  }));
});

}
