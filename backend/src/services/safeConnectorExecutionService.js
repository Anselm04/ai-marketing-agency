import { connectorRequest, getTokens } from './appConnector.js';

function connectorAccessError(message, code, statusCode = 403) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
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

  if (authType === 'api_key') {
    // API-key connector definitions currently source credentials from server
    // environment variables. Those are company credentials, not tenant-owned
    // credentials. Never let a normal customer/orchestrated task inherit them.
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

  return connectorRequest(userId, connectorId, definition, operation, payload);
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

export default { customerConnectorCapability, executeCustomerConnectorRequest };
