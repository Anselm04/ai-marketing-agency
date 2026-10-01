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
import store from '../utils/store.js';
import { encryptUtf8 } from '../utils/owner.js';
import {
  publicFrontendBase,
  resolvePlatform,
  connectorOAuthCallbackUrl,
  createPkcePair,
  rememberPkce,
  takePkce,
  getClientCredentials,
} from '../services/oauthPlatforms.js';

const router = express.Router();

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
router.get('/:id/auth', authenticate, (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: 'Connector not found' });
  }

  if (connector.auth?.type !== 'oauth2' || !connector.auth.authorizationUrl) {
    return res.status(400).json({ error: 'This connector does not use OAuth2' });
  }

  const mapping = resolvePlatform(connector.id);
  const state = Buffer.from(JSON.stringify({
    userId: req.user?.id,
    connectorId: connector.id,
    platform: mapping?.platform || null,
  })).toString('base64url');
  let clientId = connector.auth.clientId || process.env[`${connector.id.toUpperCase().replace(/-/g, '_')}_CLIENT_ID`];
  if (mapping) {
    const creds = getClientCredentials(mapping);
    clientId = creds.clientId || clientId;
  }

  if (!clientId) {
    return res.status(400).json({
      error: 'Connector client ID not configured',
      needsConfig: true,
      envKeys: mapping ? getClientCredentials(mapping).envKeys : undefined,
    });
  }

  const url = new URL(connector.auth.authorizationUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', connectorOAuthCallbackUrl(connector.id));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', connector.auth.scopes?.join(' ') || '');
  url.searchParams.set('state', state);

  if (connector.id === 'twitter_x') {
    const { verifier, challenge } = createPkcePair();
    rememberPkce(state, verifier);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  if (connector.id === 'youtube' || connector.id === 'google_ads') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
  }

  res.json({
    success: true,
    authorizationUrl: url.toString(),
    connectorId: connector.id,
    scopes: connector.auth.scopes,
    redirectUri: connectorOAuthCallbackUrl(connector.id),
  });
});

/**
 * GET /api/connectors/:id/callback
 * OAuth callback endpoint for connector authorization.
 */
router.get('/:id/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  const connector = getConnectorById(req.params.id);
  const frontendUrl = publicFrontendBase();

  if (error) {
    return res.redirect(`${frontendUrl}/social?oauth_error=${encodeURIComponent(String(errorDescription || error))}`);
  }

  if (!connector || !state || !code) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    let parsed;
    try {
      parsed = JSON.parse(Buffer.from(String(state), 'base64url').toString());
    } catch {
      parsed = JSON.parse(Buffer.from(String(state), 'base64').toString());
    }
    const userId = parsed.userId;
    const platformFromState = parsed.platform || null;

    // Prefer oauthPlatforms mapping credentials (includes TWITTER_CLIENT_ID aliases)
    const mapping = resolvePlatform(platformFromState || connector.id);
    let clientId = connector.auth.clientId || process.env[`${connector.id.toUpperCase().replace(/-/g, '_')}_CLIENT_ID`];
    let clientSecret = connector.auth.clientSecret || process.env[`${connector.id.toUpperCase().replace(/-/g, '_')}_CLIENT_SECRET`];
    if (mapping) {
      const creds = getClientCredentials(mapping);
      clientId = creds.clientId || clientId;
      clientSecret = creds.clientSecret || clientSecret;
    }

    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Connector credentials not configured', needsConfig: true });
    }

    const redirectUri = connectorOAuthCallbackUrl(connector.id);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (connector.id === 'twitter_x') {
      const verifier = takePkce(String(state));
      if (verifier) body.set('code_verifier', verifier);
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    }

    const axios = (await import('axios')).default;
    const tokenResponse = await axios.post(connector.auth.tokenUrl, body, { headers });

    await storeTokens(userId, connector.id, {
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token,
      expiresAt: tokenResponse.data.expires_in ? Date.now() + tokenResponse.data.expires_in * 1000 : null,
      scopes: tokenResponse.data.scope?.split(/[\s,]+/).filter(Boolean) || connector.auth.scopes || [],
    });

    // Also upsert the social connection used by /social/publish
    const canonical = mapping?.platform || platformFromState || connector.id;
    let tokenCipher;
    try { tokenCipher = encryptUtf8(String(tokenResponse.data.access_token), 'social-token'); } catch { /* ignore */ }
    if (userId && canonical) {
      store.upsertSocialConnection(userId, canonical, {
        tokenSet: true,
        status: 'ready',
        tokenCipher: tokenCipher || undefined,
        connectorId: connector.id,
        label: mapping?.label || connector.name,
        note: 'Connected via OAuth. Token stored encrypted; value not returned.',
      });
    }

    logger.info(`Connector ${connector.id} connected for user ${userId}`);

    const plat = encodeURIComponent(canonical);
    res.redirect(`${frontendUrl}/social?connected=${plat}`);
  } catch (err) {
    logger.error('OAuth callback failed', { error: err.message, connectorId: connector.id });
    res.redirect(`${frontendUrl}/social?oauth_error=${encodeURIComponent(err.message || 'oauth_failed')}`);
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
