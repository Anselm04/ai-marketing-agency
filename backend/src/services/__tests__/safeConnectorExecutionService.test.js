import { beforeEach, describe, expect, test, jest } from '@jest/globals';

const connectorRequest = jest.fn();
const ensureValidToken = jest.fn();
const getTokens = jest.fn();
const tokenExpiryMs = jest.fn((value) => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
});

jest.unstable_mockModule('../appConnector.js', () => ({
  connectorRequest,
  ensureValidToken,
  getTokens,
  tokenExpiryMs,
}));

const {
  customerConnectorCapability,
  executeCustomerConnectorRequest,
  requiredConnectorUrlParams,
} = await import('../safeConnectorExecutionService.js');

beforeEach(() => {
  connectorRequest.mockReset();
  ensureValidToken.mockReset();
  getTokens.mockReset();
  tokenExpiryMs.mockClear();
});

describe('tenant-safe connector execution', () => {
  test('blocks ordinary customers from server-wide API-key credentials', async () => {
    await expect(executeCustomerConnectorRequest({
      userId: 'customer-1',
      connectorId: 'shared-crm',
      definition: { name: 'Shared CRM', auth: { type: 'api_key' }, operations: [{ id: 'read', url: '/items' }] },
      operation: 'read',
    })).rejects.toMatchObject({ code: 'connector_customer_credentials_unavailable', statusCode: 409 });
    expect(connectorRequest).not.toHaveBeenCalled();
  });

  test('allows explicitly trusted owner/admin execution of a company-managed credential', async () => {
    connectorRequest.mockResolvedValueOnce({ ok: true });
    await expect(executeCustomerConnectorRequest({
      userId: 'owner-1',
      connectorId: 'shared-crm',
      definition: { name: 'Shared CRM', auth: { type: 'api_key' }, operations: [{ id: 'read', url: '/items' }] },
      operation: 'read',
      allowServerCredential: true,
    })).resolves.toEqual({ ok: true });
  });

  test('requires the current customer OAuth token before execution', async () => {
    getTokens.mockResolvedValueOnce(null);
    await expect(executeCustomerConnectorRequest({
      userId: 'customer-2',
      connectorId: 'oauth-crm',
      definition: { name: 'OAuth CRM', auth: { type: 'oauth2' }, operations: [{ id: 'read', url: '/items' }] },
      operation: 'read',
    })).rejects.toMatchObject({ code: 'connector_customer_auth_required', statusCode: 401 });
  });

  test('fails closed when a customer OAuth token is expired and cannot refresh', async () => {
    getTokens.mockResolvedValueOnce({ accessToken: 'expired-token', refreshToken: null, expiresAt: Date.now() - 60_000 });
    await expect(executeCustomerConnectorRequest({
      userId: 'customer-expired',
      connectorId: 'oauth-crm',
      definition: { name: 'OAuth CRM', auth: { type: 'oauth2', tokenUrl: 'https://provider.example/token' }, operations: [{ id: 'read', url: '/items' }] },
      operation: 'read',
    })).rejects.toMatchObject({ code: 'connector_customer_auth_expired', statusCode: 401 });
    expect(connectorRequest).not.toHaveBeenCalled();
  });

  test('refreshes an expiring customer token before provider execution', async () => {
    const now = Date.now();
    getTokens
      .mockResolvedValueOnce({ accessToken: 'old-token', refreshToken: 'refresh-token', expiresAt: now - 1 })
      .mockResolvedValueOnce({ accessToken: 'new-token', refreshToken: 'refresh-token', expiresAt: now + 3_600_000 });
    ensureValidToken.mockResolvedValueOnce('new-token');
    connectorRequest.mockResolvedValueOnce({ ok: true });
    const definition = {
      name: 'OAuth CRM',
      auth: { type: 'oauth2', tokenUrl: 'https://provider.example/token' },
      operations: [{ id: 'read', url: '/items' }],
    };
    await expect(executeCustomerConnectorRequest({ userId: 'customer-refresh', connectorId: 'oauth-crm', definition, operation: 'read' }))
      .resolves.toEqual({ ok: true });
    expect(ensureValidToken).toHaveBeenCalledTimes(1);
    expect(connectorRequest).toHaveBeenCalledTimes(1);
  });

  test('fails closed before provider execution when required URL parameters are missing', async () => {
    getTokens.mockResolvedValueOnce({ accessToken: 'customer-token' });
    const definition = {
      name: 'OAuth CRM', auth: { type: 'oauth2' },
      operations: [{ id: 'read', url: '/accounts/:accountId/items/:itemId' }],
    };
    expect(requiredConnectorUrlParams(definition, 'read')).toEqual(['accountId', 'itemId']);
    await expect(executeCustomerConnectorRequest({
      userId: 'customer-3', connectorId: 'oauth-crm', definition, operation: 'read',
      payload: { urlParams: { accountId: 'acct-1' } },
    })).rejects.toMatchObject({ code: 'connector_url_params_required', statusCode: 400, detail: { missing: ['itemId'] } });
  });

  test('forwards only validated path parameters to the provider request', async () => {
    getTokens.mockResolvedValueOnce({ accessToken: 'customer-token' });
    connectorRequest.mockResolvedValueOnce({ ok: true });
    const definition = {
      name: 'OAuth CRM', auth: { type: 'oauth2' },
      operations: [{ id: 'read', url: '/accounts/:accountId/items' }],
    };
    await executeCustomerConnectorRequest({
      userId: 'customer-4', connectorId: 'oauth-crm', definition, operation: 'read',
      payload: { urlParams: { accountId: 'acct-1', ignored: 'not-forwarded' }, params: { limit: 10 } },
    });
    expect(connectorRequest).toHaveBeenCalledWith(
      'customer-4', 'oauth-crm', definition, 'read',
      expect.objectContaining({ urlParams: { accountId: 'acct-1' }, params: { limit: 10 } }),
    );
  });

  test('catalogue capability identifies company-managed connectors truthfully', () => {
    expect(customerConnectorCapability({ auth: { type: 'api_key' } })).toMatchObject({ customerExecutable: false, serverCredentialManaged: true });
    expect(customerConnectorCapability({ auth: { type: 'oauth2' } })).toMatchObject({ customerExecutable: true, serverCredentialManaged: false });
  });
});
