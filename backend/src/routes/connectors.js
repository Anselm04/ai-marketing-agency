/**
 * Connector Management Routes
 * Provides endpoints for listing, connecting, managing, and executing app connectors.
 */

import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  allConnectors,
  connectorCategories,
  getConnectorById,
  getConnectorsByCategory,
  getAllConnectors,
} from '../services/connectors/index.js';
import {
  storeTokens,
  getTokens,
  createOAuthSession,
  consumeOAuthSession,
  revokeTokens,
  getUserConnectors,
  healthCheckConnector,
  getAllHealthStatus,
  connectorRequest,
  registerWebhook,
  getWebhooks,
  deleteWebhook,
} from '../services/appConnector.js';
import { logger } from '../utils/logger.js';
import { videoPlatformCatalog } from '../services/videoPlatformCatalog.js';

const router = express.Router();


function connectorClientId(connector) {
  return connector.auth?.clientId
    || process.env[`${connector.id.toUpperCase().replace(/-/g, '_')}_CLIENT_ID`];
}

function connectorClientSecret(connector) {
  return connector.auth?.clientSecret
    || process.env[`${connector.id.toUpperCase().replace(/-/g, '_')}_CLIENT_SECRET`];
}

function callbackUrl(connector) {
  return `${process.env.API_URL || 'http://localhost:3001'}/api/connectors/${connector.id}/callback`;
}

function buildAuthorizationUrl(connector, state) {
  const clientId = connectorClientId(connector);
  if (!clientId) throw new Error('Connector client ID not configured');

  const url = new URL(connector.auth.authorizationUrl);
  url.searchParams.set(connector.auth.clientIdParam || 'client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl(connector));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', (connector.auth.scopes || []).join(connector.auth.scopeSeparator || ' '));
  url.searchParams.set('state', state);

  for (const [key, value] of Object.entries(connector.auth.authorizationParams || {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function exchangeAuthorizationCode(connector, code, session) {
  const clientId = connectorClientId(connector);
  const clientSecret = connectorClientSecret(connector);
  if (!clientId || !clientSecret) throw new Error('Connector credentials not configured');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(connector),
  });
  body.set(connector.auth.tokenClientIdParam || 'client_id', clientId);

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (connector.auth.tokenAuth === 'basic') {
    body.delete(connector.auth.tokenClientIdParam || 'client_id');
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  } else {
    body.set(connector.auth.tokenClientSecretParam || 'client_secret', clientSecret);
  }

  if (session?.codeVerifier) body.set('code_verifier', session.codeVerifier);

  const axios = (await import('axios')).default;
  const response = await axios.post(connector.auth.tokenUrl, body, {
    headers,
    timeout: 30000,
  });
  return response.data;
}

function normalizeGrantedScopes(tokenData, connector) {
  const raw = tokenData.scope || tokenData.scopes;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.split(/[\s,]+/).filter(Boolean);
  return connector.auth?.scopes || [];
}

/**
 * GET /api/connectors
 * List all available connectors with categories.
 */
router.get('/', authenticate, async (req, res) => {
  const userId = req.user?.id;
  const connected = await getUserConnectors(userId, allConnectors);
  const connectedIds = new Set(connected.map((c) => c.id));

  const connectors = getAllConnectors().map((c) => ({
    ...c,
    connected: connectedIds.has(c.id),
    health: getAllHealthStatus()[c.id] || { status: 'unknown' },
  }));

  res.json({
    success: true,
    categories: connectorCategories,
    connectors,
    connected: connected.length,
    total: connectors.length,
  });
});

/**
 * GET /api/connectors/video-platforms
 * Complete social-video catalog with truthful connection/publishing capability.
 */
router.get('/video-platforms', authenticate, async (req, res) => {
  const userId = req.user?.id;
  const platforms = await Promise.all(videoPlatformCatalog.map(async (platform) => {
    const connector = platform.connectorId ? getConnectorById(platform.connectorId) : null;
    const tokens = connector ? await getTokens(userId, connector.id) : null;
    const configured = connector?.auth?.type === 'oauth2'
      ? Boolean(connectorClientId(connector) && connectorClientSecret(connector))
      : Boolean(connector);

    return {
      ...platform,
      connectorName: connector?.name || null,
      authType: connector?.auth?.type || 'none',
      connected: Boolean(tokens),
      configured,
      connectable: Boolean(
        connector
        && connector.auth?.type === 'oauth2'
        && configured
        && ['direct_api', 'adapter_pending', 'restricted_api', 'stream_or_vod_tools'].includes(platform.publish)
      ),
      directPublishingReady: platform.publish === 'direct_api',
    };
  }));

  res.json({
    success: true,
    platforms,
    total: platforms.length,
    connected: platforms.filter((platform) => platform.connected).length,
    directPublishingReady: platforms.filter((platform) => platform.directPublishingReady).length,
  });
});

/**
 * GET /api/connectors/categories
 * Get connector categories with counts.
 */
router.get('/categories', authenticate, (req, res) => {
  res.json({
    success: true,
    categories: connectorCategories,
  });
});

/**
 * GET /api/connectors/:category
 * Get connectors by category.
 */
router.get('/category/:category', authenticate, async (req, res) => {
  const { category } = req.params;
  const connectors = getConnectorsByCategory(category);
  const userId = req.user?.id;
  const connected = await getUserConnectors(userId, connectors);
  const connectedIds = new Set(connected.map((c) => c.id));

  res.json({
    success: true,
    category,
    connectors: connectors.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description,
      connected: connectedIds.has(c.id),
      health: getAllHealthStatus()[c.id] || { status: 'unknown' },
    })),
  });
});

/**
 * GET /api/connectors/:id
 * Get connector details including operations and auth configuration.
 */
router.get('/:id', authenticate, (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: 'Connector not found' });
  }

  res.json({
    success: true,
    connector: {
      id: connector.id,
      name: connector.name,
      category: connector.category,
      icon: connector.icon,
      description: connector.description,
      auth: {
        type: connector.auth?.type || 'none',
        authorizationUrl: connector.auth?.authorizationUrl || null,
        scopes: connector.auth?.scopes || [],
      },
      operations: connector.operations.map((op) => ({
        id: op.id,
        name: op.name,
        method: op.method,
        rateLimit: op.rateLimit,
      })),
      health: getAllHealthStatus()[connector.id] || { status: 'unknown' },
    },
  });
});

/**
 * GET /api/connectors/:id/auth
 * Get OAuth authorization URL for a connector.
 */
router.get('/:id/auth', authenticate, async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found' });

  if (connector.auth?.type !== 'oauth2' || !connector.auth.authorizationUrl) {
    return res.status(400).json({
      error: 'This platform does not support user OAuth through this connector',
      authType: connector.auth?.type || 'none',
    });
  }

  try {
    const state = await createOAuthSession(req.user?.id, connector.id);
    res.json({
      success: true,
      authorizationUrl: buildAuthorizationUrl(connector, state),
      connectorId: connector.id,
      scopes: connector.auth.scopes || [],
    });
  } catch (error) {
    logger.error('OAuth authorization initialization failed', {
      connectorId: connector.id,
      error: error.message,
    });
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/connectors/:id/callback
 * OAuth callback endpoint for connector authorization.
 */
router.get('/:id/callback', async (req, res) => {
  const { code, state, error: providerError, error_description: providerErrorDescription } = req.query;
  const connector = getConnectorById(req.params.id);
  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';

  if (!connector || !state) return res.status(400).json({ error: 'Invalid OAuth callback' });

  try {
    const session = await consumeOAuthSession(state, connector.id);
    if (providerError) {
      const detail = providerErrorDescription || providerError;
      return res.redirect(`${frontendUrl}/dashboard/connectors?connector_error=${encodeURIComponent(detail)}`);
    }
    if (!code) throw new Error('Authorization code missing');

    const tokenData = await exchangeAuthorizationCode(connector, code, session);
    if (!tokenData?.access_token) throw new Error('Provider did not return an access token');

    await storeTokens(session.userId, connector.id, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? Date.now() + Number(tokenData.expires_in) * 1000 : null,
      scopes: normalizeGrantedScopes(tokenData, connector),
      account: {
        openId: tokenData.open_id || null,
        userId: tokenData.user_id || null,
      },
      metadata: {
        tokenType: tokenData.token_type || 'Bearer',
      },
    });

    logger.info(`Connector ${connector.id} connected for user ${session.userId}`);
    res.redirect(`${frontendUrl}/dashboard/connectors?connector_connected=${encodeURIComponent(connector.id)}`);
  } catch (err) {
    logger.error('OAuth callback failed', { error: err.message, connectorId: connector?.id });
    res.redirect(`${frontendUrl}/dashboard/connectors?connector_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * POST /api/connectors/:id/revoke
 * Revoke connector tokens and disconnect.
 */
router.post('/:id/revoke', authenticate, async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: 'Connector not found' });
  }

  await revokeTokens(req.user?.id, connector.id, connector);
  logger.info(`Connector ${connector.id} revoked for user ${req.user?.id}`);
  res.json({ success: true, message: `Disconnected from ${connector.name}` });
});

/**
 * POST /api/connectors/:id/:operation
 * Execute a connector operation with authentication.
 */
router.post('/:id/:operation', authenticate, async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: 'Connector not found' });
  }

  const operation = req.params.operation;
  const op = connector.operations.find((o) => o.id === operation);
  if (!op) {
    return res.status(404).json({ error: 'Operation not found' });
  }

  try {
    const result = await connectorRequest(req.user?.id, connector.id, connector, operation, {
      body: req.body,
      params: req.query,
      urlParams: req.params,
    });
    res.json({ success: true, result });
  } catch (err) {
    logger.error('Connector operation failed', { error: err.message, connectorId: connector.id, operation });
    res.status(err.statusCode || 500).json({ error: err.message, detail: err.detail || null });
  }
});

/**
 * GET /api/connectors/:id/health
 * Check connector health status.
 */
router.get('/:id/health', authenticate, async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: 'Connector not found' });
  }

  const health = await healthCheckConnector(connector.id, connector);
  res.json({ success: true, health });
});

/**
 * GET /api/connectors/health/all
 * Get health status for all connectors (admin only).
 */
router.get('/health/all', authenticate, requireAdmin, (req, res) => {
  res.json({ success: true, health: getAllHealthStatus() });
});

/**
 * POST /api/connectors/:id/webhooks
 * Register a webhook for a connector.
 */
router.post('/:id/webhooks', authenticate, (req, res) => {
  const { url, events, secret } = req.body;
  if (!url || !events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'URL and events array are required' });
  }

  const webhook = registerWebhook(req.params.id, req.user?.id, url, events, secret);
  res.json({ success: true, webhook });
});

/**
 * GET /api/connectors/:id/webhooks
 * List registered webhooks for a connector.
 */
router.get('/:id/webhooks', authenticate, (req, res) => {
  const webhooks = getWebhooks(req.user?.id, req.params.id);
  res.json({ success: true, webhooks });
});

/**
 * DELETE /api/connectors/:id/webhooks/:webhookId
 * Delete a webhook registration.
 */
router.delete('/:id/webhooks/:webhookId', authenticate, (req, res) => {
  const deleted = deleteWebhook(req.params.webhookId);
  res.json({ success: true, deleted });
});

export default router;
