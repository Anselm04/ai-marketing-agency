import { describe, expect, test, jest } from '@jest/globals';

const connectorRequest = jest.fn();
const getTokens = jest.fn();

jest.unstable_mockModule('../appConnector.js', () => ({
  connectorRequest,
  getTokens,
}));

const {
  customerConnectorCapability,
  executeCustomerConnectorRequest,
} = await import('../safeConnectorExecutionService.js');

describe('tenant-safe connector execution', () => {
  test('blocks ordinary customers from server-wide API-key credentials', async () => {
    await expect(executeCustomerConnectorRequest({
      userId: 'customer-1',
      connectorId: 'shared-crm',
      definition: { name: 'Shared CRM', auth: { type: 'api_key' } },
      operation: 'read',
    })).rejects.toMatchObject({
      code: 'connector_customer_credentials_unavailable',
      statusCode: 409,
    });
    expect(connectorRequest).not.toHaveBeenCalled();
  });

  test('allows explicitly trusted owner/admin execution of a company-managed credential', async () => {
    connectorRequest.mockResolvedValueOnce({ ok: true });
    await expect(executeCustomerConnectorRequest({
      userId: 'owner-1',
      connectorId: 'shared-crm',
      definition: { name: 'Shared CRM', auth: { type: 'api_key' } },
      operation: 'read',
      allowServerCredential: true,
    })).resolves.toEqual({ ok: true });
    expect(connectorRequest).toHaveBeenCalledTimes(1);
  });

  test('requires the current customer OAuth token before execution', async () => {
    getTokens.mockResolvedValueOnce(null);
    await expect(executeCustomerConnectorRequest({
      userId: 'customer-2',
      connectorId: 'oauth-crm',
      definition: { name: 'OAuth CRM', auth: { type: 'oauth2' } },
      operation: 'read',
    })).rejects.toMatchObject({ code: 'connector_customer_auth_required', statusCode: 401 });
  });

  test('catalogue capability identifies company-managed connectors truthfully', () => {
    expect(customerConnectorCapability({ auth: { type: 'api_key' } })).toMatchObject({
      customerExecutable: false,
      serverCredentialManaged: true,
    });
    expect(customerConnectorCapability({ auth: { type: 'oauth2' } })).toMatchObject({
      customerExecutable: true,
      serverCredentialManaged: false,
    });
  });
});
