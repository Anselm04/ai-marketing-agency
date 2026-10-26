import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import socialMediaService from '../services/socialMediaService.js';
import { ORGANIC_PLATFORMS, ORGANIC_NETWORKS, ORGANIC_NETWORK_LABELS, canonicalPlatform, networkOf, CONTENT_TYPES } from '../services/spendGuard.js';
import { encryptUtf8 } from '../utils/owner.js';
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
import { storeTokens, consumeOAuthSession } from '../services/appConnector.js';
import { finalizeOAuthAccount } from '../services/organicPublisher.js';
import { logger } from '../utils/logger.js';

function socialOAuthRedirect(frontend, code, platform = null) {
  const url = new URL('/social', frontend);
  url.searchParams.set('oauth_error', code);
  if (platform) url.searchParams.set('platform', platform);
  return url.toString();
}

export function mountSocialPart1(router) {
router.get('/oauth/status', async (req, res) => {
  const uid = userIdOf(req);
  const mine = await store.getSocialConnectionsByOwner(uid);
  const byPlat = Object.fromEntries(mine.map((c) => [canonicalPlatform(c.platform), c]));
  const platforms = PRIORITY_OAUTH_PLATFORMS.map((m) => {
    const configured = isOAuthConfigured(m);
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
      pageId: conn?.pageId || undefined,
      igUserId: conn?.igUserId || undefined,
      callbackUrl: socialOAuthCallbackUrl(m.platform),
      adminConfigurationRequired: !configured,
      setupHint: configured
        ? null
        : 'Live account connection is not enabled for this platform yet. An administrator must configure the provider integration before Connect can be used.',
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
    return res.status(404).json({ error: 'Unknown OAuth platform', code: 'social_oauth_platform_unknown', platform: req.params.platform });
  }
  if (!isOAuthConfigured(mapping)) {
    return res.status(503).json({
      error: `Live account connection is not configured for ${mapping.label} yet.`,
      code: 'social_oauth_admin_configuration_required',
      adminConfigurationRequired: true,
      oauthConfigured: false,
      platform: mapping.platform,
      connectorId: mapping.connectorId,
      callbackUrl: socialOAuthCallbackUrl(mapping.platform),
    });
  }
  try {
    const built = await buildAuthorizationUrl(mapping, { userId: uid });
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
      logger.warn('Social OAuth provider configuration incomplete', { platform: mapping.platform, error: err.message });
      return res.status(503).json({
        error: `Live account connection is not configured for ${mapping.label} yet.`,
        code: 'social_oauth_admin_configuration_required',
        adminConfigurationRequired: true,
        oauthConfigured: false,
      });
    }
    logger.error('OAuth start failed', { error: err.message, code: err.code, platform: mapping.platform });
    res.status(503).json({ error: 'Could not start account authorization right now.', code: 'social_oauth_start_failed' });
  }
});

router.get('/oauth/:platform/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  const mapping = resolvePlatform(req.params.platform);
  const frontend = publicFrontendBase();
  if (error) {
    logger.warn('Social OAuth provider declined authorization', {
      platform: mapping?.platform || req.params.platform,
      providerError: error,
      providerErrorDescription: errorDescription,
    });
    return res.redirect(socialOAuthRedirect(frontend, 'oauth_authorization_declined', mapping?.platform || req.params.platform));
  }
  if (!mapping || !code || !state) {
    return res.redirect(socialOAuthRedirect(frontend, 'oauth_callback_invalid', mapping?.platform || req.params.platform));
  }
  try {
    const session = await consumeOAuthSession(String(state), mapping.connectorId);
    const userId = session.userId;
    if (!userId) throw new Error('Missing userId in OAuth session');
    if (session.platform && session.platform !== mapping.platform) {
      throw new Error('Platform mismatch in OAuth state');
    }
    const tokens = await exchangeAuthorizationCode(mapping, {
      code: String(code),
      state: String(state),
      codeVerifier: session.codeVerifier,
      redirectUri: session.redirectUri || socialOAuthCallbackUrl(mapping.platform),
    });
    const creds = getClientCredentials(mapping);
    let finalized;
    try {
      finalized = await finalizeOAuthAccount(mapping, tokens, creds);
    } catch (err) {
      if (err.partialTokens?.accessToken) {
        await storeTokens(userId, mapping.connectorId, {
          accessToken: err.partialTokens.accessToken,
          refreshToken: err.partialTokens.refreshToken,
          expiresAt: err.partialTokens.expiresAt,
          scopes: tokens.scopes,
          metadata: err.partialTokens.metadata || {},
        });
      }
      throw err;
    }
    await storeTokens(userId, mapping.connectorId, {
      accessToken: finalized.accessToken,
      refreshToken: finalized.refreshToken,
      expiresAt: finalized.expiresAt,
      scopes: finalized.scopes,
      metadata: finalized.metadata,
    });
    let tokenCipher = null;
    try { tokenCipher = encryptUtf8(String(finalized.accessToken), 'social-token'); } catch { /* JWT_SECRET required */ }
    const publicMeta = {
      pageId: finalized.metadata.pageId,
      pageName: finalized.metadata.pageName,
      igUserId: finalized.metadata.igUserId,
      igUsername: finalized.metadata.igUsername,
      personUrn: finalized.metadata.personUrn,
      openId: finalized.metadata.openId,
    };
    await store.upsertSocialConnection(userId, mapping.platform, {
      tokenSet: true,
      status: 'ready',
      tokenCipher: tokenCipher || undefined,
      connectorId: mapping.connectorId,
      label: mapping.label,
      ...Object.fromEntries(Object.entries(publicMeta).filter(([, value]) => value)),
      note: 'Connected via OAuth. Token stored encrypted; value not returned.',
    });
    logger.info('Social OAuth connected', { userId, platform: mapping.platform, connectorId: mapping.connectorId });
    return res.redirect(`${frontend}/social?connected=${encodeURIComponent(mapping.platform)}`);
  } catch (err) {
    logger.error('Social OAuth callback failed', { error: err.message, code: err.code, platform: mapping?.platform });
    return res.redirect(socialOAuthRedirect(frontend, 'oauth_exchange_failed', mapping?.platform));
  }
});

router.get('/networks', (_req, res) => {
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

export { socialOAuthRedirect };
