/**
 * App Connector Service
 * Manages 100+ external app integrations with OAuth 2.0 discovery,
 * health monitoring, rate limiting, and automatic retry.
 *
 * Features:
 * - Connector registry with metadata and capabilities
 * - OAuth 2.0 flow management (authorization, token refresh, revocation)
 * - Health monitoring with automatic disable/reenable
 * - Rate limit tracking per connector per user
 * - Webhook endpoint registration and routing
 * - API proxy with caching and retry
 */

import crypto from 'crypto';
import axios from 'axios';
import { logger, logConnectorRequest } from '../utils/logger.js';
import { cache } from '../utils/cache.js';
import { recordConnectorRequest } from '../utils/metrics.js';
import store from '../utils/store.js';

const TOKEN_PREFIX = 'connector_tokens';
const OAUTH_SESSION_PREFIX = 'connector_oauth_session';
const OAUTH_SESSION_TTL_MS = 10 * 60 * 1000;
const healthStatus = new Map(); // key: connectorId, value: { status, lastChecked, failures, lastError }
const rateLimitState = new Map(); // key: `${userId}:${connectorId}`, value: { requests, windowStart, limit }
const webhookRegistrations = new Map(); // key: webhookId, value: { connectorId, userId, url, events, secret }

const MAX_FAILURES = parseInt(process.env.INTEGRATION_MAX_FAILURES, 10) || 5;
const AUTO_DISABLE = process.env.INTEGRATION_AUTO_DISABLE !== 'false';
const AUTO_REENABLE = process.env.INTEGRATION_AUTO_REENABLE !== 'false';
const HEALTH_CHECK_INTERVAL = parseInt(process.env.INTEGRATION_HEALTH_CHECK_INTERVAL_MS, 10) || 60000;
const CONNECTOR_TIMEOUT = parseInt(process.env.CONNECTOR_TIMEOUT_MS, 10) || 30000;

/**
 * Connector secrets are encrypted at rest before entering the shared settings table.
 * Production must provide ENCRYPTION_KEY; development can use a local-only fallback.
 */
function secretMaterial() {
  const source = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!source || source.length < 32)) {
    throw new Error('ENCRYPTION_KEY (or JWT_SECRET) must be at least 32 characters in production');
  }
  return source || 'development-only-connector-secret-do-not-use-in-production';
}

function encryptionKey() {
  return crypto.createHash('sha256').update(secretMaterial()).digest();
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    data: encrypted.toString('base64url'),
  };
}

function decryptJson(payload) {
  if (!payload || payload.version !== 1 || payload.algorithm !== 'aes-256-gcm') return null;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(payload.iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
    const clear = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64url')),
      decipher.final(),
    ]);
    return JSON.parse(clear.toString('utf8'));
  } catch {
    return null;
  }
}

function tokenStorageKey(userId, connectorId) {
  return `${TOKEN_PREFIX}:${userId}:${connectorId}`;
}

function oauthSessionStorageKey(nonce) {
  return `${OAUTH_SESSION_PREFIX}:${nonce}`;
}

function stateSignature(nonce) {
  return crypto
    .createHmac('sha256', secretMaterial())
    .update(nonce)
    .digest('base64url');
}

export async function createOAuthSession(userId, connectorId, extra = {}) {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const record = {
    userId,
    connectorId,
    ...extra,
    createdAt: Date.now(),
    expiresAt: Date.now() + OAUTH_SESSION_TTL_MS,
  };
  await store.setSettings(oauthSessionStorageKey(nonce), encryptJson(record));
  return `${nonce}.${stateSignature(nonce)}`;
}

export async function consumeOAuthSession(state, connectorId) {
  const [nonce, signature] = String(state || '').split('.');
  if (!nonce || !signature) throw new Error('Invalid OAuth state');

  const expected = stateSignature(nonce);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length
    || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid OAuth state signature');
  }

  const key = oauthSessionStorageKey(nonce);
  const encrypted = await store.getSetting(key);
  await store.deleteSetting(key);
  const session = decryptJson(encrypted);

  if (!session) throw new Error('OAuth session not found or unreadable');
  if (session.expiresAt < Date.now()) throw new Error('OAuth session expired');
  if (session.connectorId !== connectorId) throw new Error('OAuth connector mismatch');
  return session;
}

/**
 * Store OAuth tokens durably for a user/connector pair.
 */
export async function storeTokens(userId, connectorId, tokens) {
  if (!userId || !connectorId || !tokens?.accessToken) {
    throw new Error('userId, connectorId and accessToken are required');
  }

  const key = `${userId}:${connectorId}`;
  const normalized = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || null,
    expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt).getTime() : null,
    scopes: Array.isArray(tokens.scopes) ? tokens.scopes : [],
    account: tokens.account || null,
    metadata: tokens.metadata || {},
    updatedAt: Date.now(),
  };

  await store.setSettings(tokenStorageKey(userId, connectorId), encryptJson(normalized));
  await cache.set(`tokens:${key}`, normalized, 60, 'connector');
}

/**
 * Retrieve OAuth tokens for a user/connector pair.
 */
export async function getTokens(userId, connectorId) {
  const key = `${userId}:${connectorId}`;
  const cached = await cache.get(`tokens:${key}`, 'connector');
  if (cached) return cached;

  const encrypted = await store.getSetting(tokenStorageKey(userId, connectorId));
  const tokens = decryptJson(encrypted);
  if (!tokens?.accessToken) return null;

  await cache.set(`tokens:${key}`, tokens, 60, 'connector');
  return tokens;
}

/**
 * Check if a token is expired and refresh if possible.
 */
export async function ensureValidToken(userId, connectorId, definition) {
  const tokens = await getTokens(userId, connectorId);
  if (!tokens) return null;

  if (tokens.expiresAt && Date.now() > tokens.expiresAt.getTime() - 60000) {
    // Token expires within 60 seconds, try to refresh
    if (tokens.refreshToken && definition.auth?.tokenUrl) {
      try {
        const refreshed = await refreshOAuthToken(definition, tokens.refreshToken);
        await storeTokens(userId, connectorId, {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || tokens.refreshToken,
          expiresAt: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null,
          scopes: refreshed.scope?.split(' ') || tokens.scopes,
        });
        return refreshed.access_token;
      } catch (err) {
        logger.warn(`Token refresh failed for ${connectorId}`, { error: err.message });
        return tokens.accessToken; // Return old token, let caller handle failure
      }
    }
  }
  return tokens.accessToken;
}

/**
 * Refresh an OAuth 2.0 token.
 */
async function refreshOAuthToken(definition, refreshToken) {
  const clientId = definition.auth.clientId
    || process.env[`${definition.id.toUpperCase().replace(/-/g, '_')}_CLIENT_ID`];
  const clientSecret = definition.auth.clientSecret
    || process.env[`${definition.id.toUpperCase().replace(/-/g, '_')}_CLIENT_SECRET`];

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  if (definition.auth.tokenAuth === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  } else {
    body.set(definition.auth.tokenClientIdParam || 'client_id', clientId || '');
    if (clientSecret) {
      body.set(definition.auth.tokenClientSecretParam || 'client_secret', clientSecret);
    }
  }

  if (definition.auth.refreshScope === true && definition.auth.scopes?.length) {
    body.set('scope', definition.auth.scopes.join(definition.auth.scopeSeparator || ' '));
  }

  const response = await axios.post(definition.auth.tokenUrl, body, {
    headers,
    timeout: 30000,
  });
  return response.data;
}

/**
 * Check rate limit for a user/connector pair.
 * Returns true if request is allowed, false if rate limited.
 */
export function checkRateLimit(userId, connectorId, limit = 100, windowMs = 60000) {
  const key = `${userId}:${connectorId}`;
  const now = Date.now();
  let state = rateLimitState.get(key);

  if (!state || now > state.windowStart + windowMs) {
    state = { requests: 0, windowStart: now, limit };
  }

  if (state.requests >= limit) {
    return false;
  }

  state.requests++;
  rateLimitState.set(key, state);
  return true;
}

/**
 * Make an authenticated API request through a connector.
 * Handles token injection, rate limiting, caching, and retry.
 */
export async function connectorRequest(userId, connectorId, definition, operation, payload = {}) {
  const start = Date.now();
  const op = definition.operations.find((o) => o.id === operation);
  if (!op) throw new Error(`Operation ${operation} not found for connector ${connectorId}`);

  // Check rate limit
  if (!checkRateLimit(userId, connectorId, op.rateLimit?.requests || 100, op.rateLimit?.windowMs || 60000)) {
    const err = new Error(`Rate limit exceeded for ${connectorId}:${operation}`);
    err.statusCode = 429;
    throw err;
  }

  // Get token
  const token = await ensureValidToken(userId, connectorId, definition);
  if (!token && definition.auth?.type === 'oauth2') {
    const err = new Error(`Not authenticated with ${connectorId}`);
    err.statusCode = 401;
    throw err;
  }

  // Build URL
  let url = op.url;
  if (payload.urlParams) {
    Object.entries(payload.urlParams).forEach(([key, val]) => {
      url = url.replace(`:${key}`, encodeURIComponent(val));
    });
  }
  if (!url.startsWith('http')) {
    url = `${definition.baseUrl}${url}`;
  }

  // Check cache for GET requests
  if (op.method === 'GET' && op.cacheable) {
    const cacheKey = `connector:${connectorId}:${operation}:${JSON.stringify(payload.params || {})}`;
    const cached = await cache.get(cacheKey, 'connector');
    if (cached) {
      logConnectorRequest(connectorId, operation, Date.now() - start, 'cache_hit');
      return cached;
    }
  }

  // Build request config
  const config = {
    method: op.method || 'GET',
    url,
    timeout: op.timeout || CONNECTOR_TIMEOUT,
    headers: {
      ...(op.headers || {}),
      ...(payload.headers || {}),
    },
  };

  if (token) {
    if (definition.auth.headerPrefix) {
      config.headers.Authorization = `${definition.auth.headerPrefix} ${token}`;
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  if (definition.auth.apiKeyHeader && definition.auth.apiKeyValue) {
    config.headers[definition.auth.apiKeyHeader] = definition.auth.apiKeyValue;
  }

  if (op.method === 'GET' || op.method === 'DELETE') {
    config.params = payload.params || {};
  } else {
    config.data = payload.body || payload.params || {};
  }

  // Execute request with retry
  let lastError = null;
  const retries = op.retries || 1;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios(config);
      const duration = Date.now() - start;
      logConnectorRequest(connectorId, operation, duration, 'success');
      recordConnectorRequest(connectorId, operation, duration, 'success');

      // Cache GET responses
      if (op.method === 'GET' && op.cacheable) {
        const cacheKey = `connector:${connectorId}:${operation}:${JSON.stringify(payload.params || {})}`;
        await cache.set(cacheKey, response.data, op.cacheTtl || 300, 'connector');
      }

      return response.data;
    } catch (err) {
      lastError = err;
      if (attempt < retries && (err.response?.status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      break;
    }
  }

  const duration = Date.now() - start;
  logConnectorRequest(connectorId, operation, duration, 'error', lastError);
  recordConnectorRequest(connectorId, operation, duration, 'error');

  // Update health status on failure
  updateHealthStatus(connectorId, false, lastError.message);

  throw lastError;
}

/**
 * Update health status for a connector.
 */
function updateHealthStatus(connectorId, healthy, error = null) {
  let status = healthStatus.get(connectorId);
  if (!status) {
    status = { failures: 0, lastChecked: Date.now(), status: 'up', lastError: null };
  }
  status.lastChecked = Date.now();
  if (healthy) {
    status.failures = 0;
    status.status = 'up';
    status.lastError = null;
  } else {
    status.failures++;
    status.lastError = error;
    if (status.failures >= MAX_FAILURES && AUTO_DISABLE) {
      status.status = 'down';
      logger.warn(`Connector ${connectorId} auto-disabled after ${MAX_FAILURES} failures`);
    } else if (status.failures > 0) {
      status.status = 'degraded';
    }
  }
  healthStatus.set(connectorId, status);
}

/**
 * Run health check for a connector.
 */
export async function healthCheckConnector(connectorId, definition) {
  if (!definition.healthCheck) return { status: 'unknown', detail: 'No health check configured' };

  try {
    const start = Date.now();
    const response = await axios({
      method: definition.healthCheck.method || 'GET',
      url: definition.healthCheck.url,
      timeout: 10000,
      headers: definition.healthCheck.headers || {},
    });
    const duration = Date.now() - start;
    const healthy = definition.healthCheck.validate ? definition.healthCheck.validate(response) : response.status < 400;
    updateHealthStatus(connectorId, healthy);
    return { status: healthy ? 'up' : 'degraded', latency: duration, detail: definition.healthCheck.detail || 'OK' };
  } catch (err) {
    updateHealthStatus(connectorId, false, err.message);
    return { status: 'down', error: err.message };
  }
}

/**
 * Get health status for all connectors.
 */
export function getAllHealthStatus() {
  return Object.fromEntries(healthStatus);
}

/**
 * Get health status for a specific connector.
 */
export function getHealthStatus(connectorId) {
  return healthStatus.get(connectorId) || { status: 'unknown', failures: 0, lastChecked: null };
}

/**
 * Register a webhook for a connector.
 */
export function registerWebhook(connectorId, userId, url, events, secret = null) {
  const id = `wh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  webhookRegistrations.set(id, {
    id,
    connectorId,
    userId,
    url,
    events,
    secret,
    createdAt: Date.now(),
  });
  return { id, url, events };
}

/**
 * Get registered webhooks for a user/connector.
 */
export function getWebhooks(userId, connectorId) {
  const result = [];
  for (const wh of webhookRegistrations.values()) {
    if (wh.userId === userId && wh.connectorId === connectorId) {
      result.push(wh);
    }
  }
  return result;
}

/**
 * Delete a webhook.
 */
export function deleteWebhook(webhookId) {
  return webhookRegistrations.delete(webhookId);
}

/**
 * Verify webhook signature (if secret is configured).
 */
export function verifyWebhookSignature(payload, signature, secret) {
  if (!secret) return true;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

/**
 * Revoke OAuth tokens for a user/connector.
 */
export async function revokeTokens(userId, connectorId, definition) {
  const tokens = await getTokens(userId, connectorId);
  if (!tokens) return false;

  if (definition.auth?.revokeUrl) {
    try {
      await axios.post(
        definition.auth.revokeUrl,
        new URLSearchParams({
          token: tokens.accessToken,
          client_id: definition.auth.clientId || process.env[`${definition.id.toUpperCase()}_CLIENT_ID`],
          client_secret: definition.auth.clientSecret || process.env[`${definition.id.toUpperCase()}_CLIENT_SECRET`],
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
    } catch (err) {
      logger.warn(`Token revocation failed for ${connectorId}`, { error: err.message });
    }
  }

  await store.deleteSetting(tokenStorageKey(userId, connectorId));
  await cache.del(`tokens:${userId}:${connectorId}`, 'connector');
  return true;
}

/**
 * Get user-connected connectors.
 */
export async function getUserConnectors(userId, connectorDefinitions) {
  const connected = [];
  for (const def of connectorDefinitions) {
    const tokens = await getTokens(userId, def.id);
    if (tokens) {
      connected.push({
        id: def.id,
        name: def.name,
        category: def.category,
        connected: true,
        scopes: tokens.scopes,
        health: getHealthStatus(def.id),
      });
    }
  }
  return connected;
}

/**
 * Initialize periodic health checks for all connectors.
 */
export function initializeHealthChecks(connectorDefinitions) {
  if (HEALTH_CHECK_INTERVAL < 1000) return;

  setInterval(async () => {
    for (const def of connectorDefinitions) {
      await healthCheckConnector(def.id, def);
    }
  }, HEALTH_CHECK_INTERVAL);

  logger.info(`Health checks initialized for ${connectorDefinitions.length} connectors every ${HEALTH_CHECK_INTERVAL}ms`);
}

export default {
  storeTokens,
  getTokens,
  createOAuthSession,
  consumeOAuthSession,
  ensureValidToken,
  checkRateLimit,
  connectorRequest,
  healthCheckConnector,
  getAllHealthStatus,
  getHealthStatus,
  registerWebhook,
  getWebhooks,
  deleteWebhook,
  verifyWebhookSignature,
  revokeTokens,
  getUserConnectors,
  initializeHealthChecks,
};
