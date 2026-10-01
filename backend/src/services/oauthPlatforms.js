/**
 * Priority OAuth platform mapping: organic/paid UI ids → connector defs + env keys.
 * Honest: oauthConfigured is true only when both client id and secret env vars are present.
 */

import { createHash, randomBytes } from 'crypto';
import { getConnectorById } from './connectors/index.js';

export const PUBLIC_API_BASE =
  process.env.API_URL || process.env.PUBLIC_URL || 'https://trillionai-marketing.fly.dev';

export const PUBLIC_FRONTEND_BASE =
  process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'https://trillionai-marketing.fly.dev';

/** Short-lived PKCE verifiers keyed by OAuth state (in-memory; fine for single instance). */
export const pkceStore = new Map();

const PKCE_TTL_MS = 10 * 60 * 1000;

export function publicApiBase() {
  return String(PUBLIC_API_BASE).replace(/\/$/, '');
}

export function publicFrontendBase() {
  return String(PUBLIC_FRONTEND_BASE).replace(/\/$/, '');
}

/**
 * Priority platforms for Marketing Social / Ads connect.
 * platform = canonical UI id used by /social and spendGuard.
 */
export const PRIORITY_OAUTH_PLATFORMS = [
  {
    platform: 'x',
    aliases: ['twitter', 'twitter/x'],
    connectorId: 'twitter_x',
    label: 'X (Twitter)',
    kind: 'organic',
    clientIdEnv: ['TWITTER_CLIENT_ID', 'TWITTER_API_KEY'],
    clientSecretEnv: ['TWITTER_CLIENT_SECRET', 'TWITTER_API_SECRET'],
    pkce: true,
    tokenKey: 'twitter',
  },
  {
    platform: 'tiktok',
    aliases: [],
    connectorId: 'tiktok',
    label: 'TikTok',
    kind: 'organic',
    clientIdEnv: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_ID'],
    clientSecretEnv: ['TIKTOK_CLIENT_SECRET'],
    pkce: false,
    tokenKey: 'tiktok',
  },
  {
    platform: 'instagram',
    aliases: [],
    connectorId: 'meta_instagram',
    label: 'Instagram',
    kind: 'organic',
    clientIdEnv: ['META_APP_ID', 'FACEBOOK_APP_ID'],
    clientSecretEnv: ['META_APP_SECRET', 'FACEBOOK_APP_SECRET'],
    pkce: false,
    tokenKey: 'instagram',
  },
  {
    platform: 'facebook',
    aliases: [],
    connectorId: 'meta_facebook',
    label: 'Facebook',
    kind: 'organic',
    clientIdEnv: ['META_APP_ID', 'FACEBOOK_APP_ID'],
    clientSecretEnv: ['META_APP_SECRET', 'FACEBOOK_APP_SECRET'],
    pkce: false,
    tokenKey: 'facebook',
  },
  {
    platform: 'linkedin',
    aliases: [],
    connectorId: 'linkedin',
    label: 'LinkedIn',
    kind: 'organic',
    clientIdEnv: ['LINKEDIN_CLIENT_ID'],
    clientSecretEnv: ['LINKEDIN_CLIENT_SECRET'],
    pkce: false,
    tokenKey: 'linkedin',
  },
  {
    platform: 'youtube',
    aliases: [],
    connectorId: 'youtube',
    label: 'YouTube',
    kind: 'organic',
    clientIdEnv: ['GOOGLE_CLIENT_ID', 'YOUTUBE_CLIENT_ID'],
    clientSecretEnv: ['GOOGLE_CLIENT_SECRET', 'YOUTUBE_CLIENT_SECRET'],
    pkce: false,
    tokenKey: 'youtube',
  },
  {
    platform: 'meta',
    aliases: ['meta_ads', 'meta-ads'],
    connectorId: 'meta_ads',
    label: 'Meta Ads',
    kind: 'ads',
    clientIdEnv: ['META_APP_ID', 'FACEBOOK_APP_ID'],
    clientSecretEnv: ['META_APP_SECRET', 'FACEBOOK_APP_SECRET'],
    pkce: false,
    tokenKey: 'metaAds',
  },
  {
    platform: 'google',
    aliases: ['google_ads', 'google-ads'],
    connectorId: 'google_ads',
    label: 'Google Ads',
    kind: 'ads',
    clientIdEnv: ['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_CLIENT_ID'],
    clientSecretEnv: ['GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'],
    pkce: false,
    tokenKey: 'googleAds',
  },
];

function firstEnv(keys) {
  for (const k of keys || []) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== '') return { key: k, value: String(v).trim() };
  }
  return null;
}

export function resolvePlatform(platformOrAlias) {
  const id = String(platformOrAlias || '').toLowerCase().trim();
  if (!id) return null;
  return (
    PRIORITY_OAUTH_PLATFORMS.find(
      (p) => p.platform === id || (p.aliases || []).includes(id) || p.connectorId === id
    ) || null
  );
}

export function getClientCredentials(mapping) {
  const idHit = firstEnv(mapping.clientIdEnv);
  const secretHit = firstEnv(mapping.clientSecretEnv);
  return {
    clientId: idHit?.value || null,
    clientSecret: secretHit?.value || null,
    clientIdKey: idHit?.key || mapping.clientIdEnv[0],
    clientSecretKey: secretHit?.key || mapping.clientSecretEnv[0],
    envKeys: [...mapping.clientIdEnv, ...mapping.clientSecretEnv],
  };
}

export function isOAuthConfigured(mapping) {
  const { clientId, clientSecret } = getClientCredentials(mapping);
  return !!(clientId && clientSecret);
}

export function getConnectorForPlatform(mapping) {
  return getConnectorById(mapping.connectorId) || null;
}

export function socialOAuthCallbackUrl(platform) {
  return `${publicApiBase()}/api/social/oauth/${encodeURIComponent(platform)}/callback`;
}

export function connectorOAuthCallbackUrl(connectorId) {
  return `${publicApiBase()}/api/connectors/${encodeURIComponent(connectorId)}/callback`;
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function rememberPkce(state, verifier) {
  pkceStore.set(state, { verifier, expiresAt: Date.now() + PKCE_TTL_MS });
  // opportunistic cleanup
  if (pkceStore.size > 200) {
    const now = Date.now();
    for (const [k, v] of pkceStore) {
      if (v.expiresAt < now) pkceStore.delete(k);
    }
  }
}

export function takePkce(state) {
  const row = pkceStore.get(state);
  pkceStore.delete(state);
  if (!row) return null;
  if (row.expiresAt < Date.now()) return null;
  return row.verifier;
}

export function buildAuthorizationUrl(mapping, { userId, redirectUri } = {}) {
  const connector = getConnectorForPlatform(mapping);
  if (!connector?.auth?.authorizationUrl) {
    const err = new Error('Connector OAuth authorization URL missing');
    err.code = 'NO_AUTH_URL';
    throw err;
  }
  const creds = getClientCredentials(mapping);
  if (!creds.clientId || !creds.clientSecret) {
    const err = new Error('OAuth app credentials not configured');
    err.code = 'NEEDS_CONFIG';
    err.envKeys = creds.envKeys;
    err.needsConfig = true;
    throw err;
  }

  const statePayload = {
    userId,
    platform: mapping.platform,
    connectorId: mapping.connectorId,
    nonce: randomBytes(8).toString('hex'),
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
  const cb = redirectUri || socialOAuthCallbackUrl(mapping.platform);

  const url = new URL(connector.auth.authorizationUrl);
  url.searchParams.set('client_id', creds.clientId);
  url.searchParams.set('redirect_uri', cb);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', (connector.auth.scopes || []).join(' '));
  url.searchParams.set('state', state);

  // Google / YouTube expect these
  if (mapping.connectorId === 'youtube' || mapping.connectorId === 'google_ads') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
  }

  let codeVerifier = null;
  if (mapping.pkce || mapping.connectorId === 'twitter_x') {
    const { verifier, challenge } = createPkcePair();
    codeVerifier = verifier;
    rememberPkce(state, verifier);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  return {
    authorizationUrl: url.toString(),
    state,
    redirectUri: cb,
    scopes: connector.auth.scopes || [],
    connectorId: mapping.connectorId,
    codeVerifier,
  };
}

export async function exchangeAuthorizationCode(mapping, { code, redirectUri, state }) {
  const connector = getConnectorForPlatform(mapping);
  if (!connector?.auth?.tokenUrl) {
    throw new Error('Connector token URL missing');
  }
  const creds = getClientCredentials(mapping);
  if (!creds.clientId || !creds.clientSecret) {
    const err = new Error('OAuth app credentials not configured');
    err.needsConfig = true;
    err.envKeys = creds.envKeys;
    throw err;
  }

  const cb = redirectUri || socialOAuthCallbackUrl(mapping.platform);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(code),
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: cb,
  });

  if (mapping.pkce || mapping.connectorId === 'twitter_x') {
    const verifier = takePkce(state);
    if (!verifier) {
      throw new Error('PKCE code_verifier missing or expired — restart OAuth connect');
    }
    body.set('code_verifier', verifier);
  }

  const axios = (await import('axios')).default;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  // Twitter confidential clients often use Basic auth; include both for compatibility
  if (mapping.connectorId === 'twitter_x') {
    headers.Authorization = `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64')}`;
  }

  const tokenResponse = await axios.post(connector.auth.tokenUrl, body, { headers });
  return {
    accessToken: tokenResponse.data.access_token,
    refreshToken: tokenResponse.data.refresh_token || null,
    expiresAt: tokenResponse.data.expires_in
      ? Date.now() + Number(tokenResponse.data.expires_in) * 1000
      : null,
    scopes: tokenResponse.data.scope
      ? String(tokenResponse.data.scope).split(/[\s,]+/).filter(Boolean)
      : connector.auth.scopes || [],
    raw: tokenResponse.data,
  };
}

export default {
  PRIORITY_OAUTH_PLATFORMS,
  publicApiBase,
  publicFrontendBase,
  resolvePlatform,
  getClientCredentials,
  isOAuthConfigured,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  socialOAuthCallbackUrl,
  connectorOAuthCallbackUrl,
};
