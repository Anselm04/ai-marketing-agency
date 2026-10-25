import axios from 'axios';
import { ensureValidToken } from './appConnector.js';

const statusByUserConnector = new Map();
const HEALTH_TIMEOUT_MS = Number(process.env.CONNECTOR_HEALTH_TIMEOUT_MS) || 10000;

function healthKey(userId, connectorId) {
  return `${userId}:${connectorId}`;
}

function publicError(error) {
  const status = Number(error?.response?.status) || Number(error?.statusCode) || null;
  return {
    status,
    code: error?.code || null,
    message: status === 401 || status === 403
      ? 'Connected credentials are not authorized for this provider health check.'
      : 'Connector health check failed.',
  };
}

export function getUserConnectorHealth(userId, connectorId) {
  return statusByUserConnector.get(healthKey(userId, connectorId)) || {
    status: 'unknown',
    lastChecked: null,
    latency: null,
    detail: 'Customer connection has not been probed yet.',
  };
}

export async function checkUserConnectorHealth(userId, definition) {
  if (!userId || !definition?.id) {
    return { status: 'unknown', lastChecked: Date.now(), detail: 'User and connector are required.' };
  }

  const key = healthKey(userId, definition.id);
  const checkedAt = Date.now();

  if (definition.auth?.type !== 'oauth2') {
    const result = {
      status: 'unknown',
      lastChecked: checkedAt,
      latency: null,
      detail: 'Customer OAuth health probing does not apply to this connector.',
    };
    statusByUserConnector.set(key, result);
    return result;
  }

  const token = await ensureValidToken(userId, definition.id, definition);
  if (!token) {
    const result = {
      status: 'disconnected',
      lastChecked: checkedAt,
      latency: null,
      detail: 'No current customer OAuth token is available.',
    };
    statusByUserConnector.set(key, result);
    return result;
  }

  if (!definition.healthCheck?.url) {
    const result = {
      status: 'connected_unverified',
      lastChecked: checkedAt,
      latency: null,
      detail: 'Customer OAuth token exists, but this connector has no safe probe endpoint.',
    };
    statusByUserConnector.set(key, result);
    return result;
  }

  const started = Date.now();
  try {
    const response = await axios({
      method: definition.healthCheck.method || 'GET',
      url: definition.healthCheck.url,
      timeout: HEALTH_TIMEOUT_MS,
      headers: {
        ...(definition.healthCheck.headers || {}),
        Authorization: `${definition.auth?.headerPrefix || 'Bearer'} ${token}`,
      },
    });
    const healthy = definition.healthCheck.validate
      ? definition.healthCheck.validate(response)
      : response.status >= 200 && response.status < 400;
    const result = {
      status: healthy ? 'up' : 'degraded',
      lastChecked: checkedAt,
      latency: Date.now() - started,
      detail: healthy ? (definition.healthCheck.detail || 'Authenticated provider probe succeeded.') : 'Provider probe returned an unhealthy response.',
    };
    statusByUserConnector.set(key, result);
    return result;
  } catch (error) {
    const safe = publicError(error);
    const result = {
      status: safe.status === 401 || safe.status === 403 ? 'authorization_failed' : 'down',
      lastChecked: checkedAt,
      latency: Date.now() - started,
      detail: safe.message,
      providerStatus: safe.status,
      code: safe.code,
    };
    statusByUserConnector.set(key, result);
    return result;
  }
}

export function connectorHealthAllowsExecution(health = {}) {
  return ['up', 'degraded', 'connected_unverified'].includes(health.status);
}

export default {
  checkUserConnectorHealth,
  connectorHealthAllowsExecution,
  getUserConnectorHealth,
};