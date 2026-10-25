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
  registerWebhook,
  getWebhooks,
  deleteWebhook,
} from '../services/appConnector.js';
import {
  customerConnectorCapability,
  executeCustomerConnectorRequest,
} from '../services/safeConnectorExecutionService.js';
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

function canUseServerCredential(user) {
  return Boolean(user?.isOwner || user?.role === 'admin');
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

router.get('/', authenticate, async (req, res) => {
  const userId = req.user?.id;
  const connected = await getUserConnectors(userId, allConnectors);
  const connectedIds = new Set(connected.map((c) => c.id));

  const connectors = getAllConnectors().map((c) => {
    const definition = getConnectorById(c.id);
    const capability = customerConnectorCapability(definition);
    return {
      ...c,
      connected: connectedIds.has(c.id),
      health: getAllHealthStatus()[c.id] || { status: 'unknown' },
      ...capability,
      serverCredentialExecutable: capability.serverCredentialManaged && canUseServerCredential(req.user),
    };
  });

  res.json({ success: true, categories: connectorCategories, connectors, connected: connected.length, total: connectors.length });
});

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

router.get('/categories', authenticate, (_req, res) => {
  res.json({ success: true, categories: connectorCategories });
});

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
      ...customerConnectorCapability(c),
    })),
  });
});

router.get('/:id', authenticate, (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
  const capability = customerConnectorCapability(connector);

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
      operations: connector.operations.map((op) => ({ id: op.id, name: op.name, method: op.method, rateLimit: op.rateLimit })),
      health: getAllHealthStatus()[connector.id] || { status: 'unknown' },
      ...capability,
      serverCredentialExecutable: capability.serverCredentialManaged && canUseServerCredential(req.user),
    },
  });
});

router.get('/:id/auth', authenticate, async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
  if (connector.auth?.type !== 'oauth2' || !connector.auth.authorizationUrl) {
    return res.status(400).json({ error: 'This platform does not support user OAuth through this connector', authType: connector.auth?.type || 'none' });
  }

  try {
    const state = await createOAuthSession(req.user?.id, connector.id);
    res.json({ success: true, authorizationUrl: buildAuthorizationUrl(connector, state), connectorId: connector.id, scopes: connector.auth.scopes || [] });
  } catch (error) {
    logger.error('OAuth authorization initialization failed', { connectorId: connector.id, error: error.message });
    res.status(400).json({ error: error.message });
  }
});

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
      account: { openId: tokenData.open_id || null, userId: tokenData.user_id || null },
      metadata: { tokenType: tokenData.token_type || 'Bearer' },
    });
    logger.info(`Connector ${connector.id} connected for user ${session.userId}`);
    return res.redirect(`${frontendUrl}/dashboard/connectors?connector_connected=${encodeURIComponent(connector.id)}`);
  } catch (err) {
    logger.error('OAuth callback failed', { error: err.message, connectorId: connector?.id });
    return res.redirect(`${frontendUrl}/dashboard/connectors?connector_error=${encodeURIComponent(err.message)}`);
  }
});

router.post('/:id/revoke', authenticate, async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
  await revokeTokens(req.user?.id, connector.id, connector);
  logger.info(`Connector ${connector.id} revoked for user ${req.user?.id}`);
  return res.json({ success: true, message: `Disconnected from ${connector.name}` });
});

router.post('/:id/:operation', authenticate, async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
  const operation = req.params.operation;
  const op = connector.operations.find((o) => o.id === operation);
  if (!op) return res.status(404).json({ error: 'Operation not found' });

  try {
    const result = await executeCustomerConnectorRequest({
      userId: req.user?.id,
      connectorId: connector.id,
      definition: connector,
      operation,
      allowServerCredential: canUseServerCredential(req.user),
      payload: { body: req.body, params: req.query, urlParams: req.params },
    });
    return res.json({ success: true, result });
  } catch (err) {
    logger.error('Connector operation failed', { error: err.message, connectorId: connector.id, operation });
    return res.status(err.statusCode || 500).json({ error: err.message, code: err.code || null, detail: err.detail || null });
  }
});

router.get('/:id/health', authenticate, async (req, res) => {
  const connector = getConnectorById(req.params.id);
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
  const health = await healthCheckConnector(connector.id, connector);
  return res.json({ success: true, health });
});

router.get('/health/all', authenticate, requireAdmin, (_req, res) => {
  res.json({ success: true, health: getAllHealthStatus() });
});

router.post('/:id/webhooks', authenticate, (req, res) => {
  const { url, events, secret } = req.body;
  if (!url || !events || !Array.isArray(events)) return res.status(400).json({ error: 'URL and events array are required' });
  const webhook = registerWebhook(req.params.id, req.user?.id, url, events, secret);
  return res.json({ success: true, webhook });
});

router.get('/:id/webhooks', authenticate, (req, res) => {
  const webhooks = getWebhooks(req.user?.id, req.params.id);
  res.json({ success: true, webhooks });
});

router.delete('/:id/webhooks/:webhookId', authenticate, (req, res) => {
  const deleted = deleteWebhook(req.params.webhookId);
  res.json({ success: true, deleted });
});

export default router;
