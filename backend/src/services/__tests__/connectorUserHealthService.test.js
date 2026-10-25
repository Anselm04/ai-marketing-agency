import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const ensureValidToken = jest.fn();
const axios = jest.fn();

jest.unstable_mockModule('../appConnector.js', () => ({ ensureValidToken }));
jest.unstable_mockModule('axios', () => ({ default: axios }));

const {
  checkUserConnectorHealth,
  connectorHealthAllowsExecution,
} = await import('../connectorUserHealthService.js');

const definition = {
  id: 'oauth-provider',
  auth: { type: 'oauth2', headerPrefix: 'Bearer' },
  healthCheck: { url: 'https://provider.example/me', method: 'GET' },
};

beforeEach(() => {
  ensureValidToken.mockReset();
  axios.mockReset();
});

describe('tenant-specific connector health', () => {
  test('reports disconnected when this customer has no OAuth token', async () => {
    ensureValidToken.mockResolvedValueOnce(null);
    await expect(checkUserConnectorHealth('user-1', definition)).resolves.toMatchObject({
      status: 'disconnected',
    });
    expect(axios).not.toHaveBeenCalled();
  });

  test('probes the provider with the current customer token', async () => {
    ensureValidToken.mockResolvedValueOnce('customer-token');
    axios.mockResolvedValueOnce({ status: 200, data: { id: 'customer' } });

    const result = await checkUserConnectorHealth('user-2', definition);
    expect(result.status).toBe('up');
    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://provider.example/me',
      headers: expect.objectContaining({ Authorization: 'Bearer customer-token' }),
    }));
  });

  test('authorization failure is not treated as executable health', async () => {
    ensureValidToken.mockResolvedValueOnce('revoked-token');
    axios.mockRejectedValueOnce({ response: { status: 401 }, code: 'ERR_BAD_REQUEST' });

    const result = await checkUserConnectorHealth('user-3', definition);
    expect(result.status).toBe('authorization_failed');
    expect(connectorHealthAllowsExecution(result)).toBe(false);
  });

  test('connected unverified state can execute when no safe health endpoint exists', async () => {
    ensureValidToken.mockResolvedValueOnce('valid-token');
    const result = await checkUserConnectorHealth('user-4', {
      id: 'no-probe',
      auth: { type: 'oauth2' },
    });
    expect(result.status).toBe('connected_unverified');
    expect(connectorHealthAllowsExecution(result)).toBe(true);
  });
});