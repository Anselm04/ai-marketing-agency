import { connectorRequest, getTokens } from './appConnector.js';

function connectorAccessError(message, code, statusCode = 403, detail = null) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.detail = detail;
  return error;
}

export function requiredConnectorUrlParams(definition, operation) {
  const op = definition?.operations?.find((candidate) => candidate.id === operation);
  if (!op) return [];
  const matches = String(op.url || '').matchAll(/:([A-Za-z0-9_]+)/g);
  return [...new Set([...matches].map((match) => match[1]))];
}

function validatedUrlParams(definition, operation, supplied = {}) {
  const required = requiredConnectorUrlParams(definition, operation);
  const normalized = supplied && typeof supplied === 'object' ? supplied : {};
  const missing = required.filter((key) => normalized[key] == null || String(normalized[key]).trim() === '');
  if (missing.length) {
    throw connectorAccessError(
      `Connector operation requires path parameter${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`,
      'connector_url_params_required',
      400,
      { required, missing },
    );
  }
  return Object.fromEntries(required.map((key) => [key, String(normalized[key]).trim()]));
}

export async function executeCustomerConnectorRequest({
  userId,
  connectorId,
  definition,
  operation,
  payload = {},
  allowServerCredential = false,
}) {
  const authType = definition?.auth?.type || 'none';
  const urlParams = validatedUrlParams(definition, operation, payload.urlParams);

  if (authType === 'api_key') {
    if (!allowServerCredential) {
      throw connectorAccessError(
        'This connector uses a company-managed server credential and is not available to customer automation until a per-customer credential adapter is implemented.',
        'connector_customer_credentials_unavailable',
        409,
      );
    }
  }

  if (authType === 'oauth2') {
    const tokens = await getTokens(userId, connectorId);
    if (!tokens?.accessToken) {
      throw connectorAccessError(
        `Connect ${definition?.name || connectorId} for this account before running the operation.`,
        'connector_customer_auth_required',
        401,
      );
    }
  }

  return connectorRequest(userId, connectorId, definition, operation, {
    ...payload,
    urlParams,
  });
}

export function customerConnectorCapability(definition) {
  const authType = definition?.auth?.type || 'none';
  return {
    authType,
    customerExecutable: authType !== 'api_key',
    serverCredentialManaged: authType === 'api_key',
    reason: authType === 'api_key'
      ? 'Company-managed credential. Per-customer credential execution is not implemented for this connector.'
      : null,
  };
}

export default {
  customerConnectorCapability,
  executeCustomerConnectorRequest,
  requiredConnectorUrlParams,
};