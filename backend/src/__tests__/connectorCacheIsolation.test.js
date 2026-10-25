import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
const axios = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: axios }));
const { connectorRequest, storeTokens } = await import('../services/appConnector.js');
const { cache } = await import('../utils/cache.js');
const definition = {
  auth: { type: 'oauth2', headerPrefix: 'Bearer' }, baseUrl: 'https://provider.example',
  operations: [{ id: 'read', method: 'GET', url: '/accounts/:accountId/items', cacheable: true, rateLimit: { requests: 10000 } }],
};
afterEach(() => jest.restoreAllMocks());
let counter = 0;
let connector;
beforeEach(() => {
  connector = `isolation-${++counter}`;
  axios.mockReset();
  axios.mockImplementation(async (config) => ({ data: { account: config.headers.Authorization, resource: config.url, locale: config.headers['Accept-Language'] } }));
});

describe('connector response cache boundaries', () => {
  test('two customers with the same connector and query never share response data', async () => {
    await storeTokens('customer-a', connector, { accessToken: 'token-a' });
    await storeTokens('customer-b', connector, { accessToken: 'token-b' });
    const a = await connectorRequest('customer-a', connector, definition, 'read', { urlParams: { accountId: 'same' } });
    const b = await connectorRequest('customer-b', connector, definition, 'read', { urlParams: { accountId: 'same' } });
    expect(a.account).toBe('Bearer token-a');
    expect(b.account).toBe('Bearer token-b');
    expect(axios).toHaveBeenCalledTimes(2);
    expect(await connectorRequest('customer-a', connector, definition, 'read', { urlParams: { accountId: 'same' } })).toEqual(a);
    expect(axios).toHaveBeenCalledTimes(2);
  });
  test('different URL resources and effective headers have distinct cached responses', async () => {
    await storeTokens('customer-a', connector, { accessToken: 'token-a' });
    for (const [accountId, locale] of [['one', 'en'], ['two', 'en'], ['two', 'fr']]) {
      const result = await connectorRequest('customer-a', connector, definition, 'read', { urlParams: { accountId }, headers: { 'Accept-Language': locale } });
      expect(result.resource).toBe(`https://provider.example/accounts/${accountId}/items`);
      expect(result.locale).toBe(locale);
    }
    expect(axios).toHaveBeenCalledTimes(3);
  });
  test('reconnecting to a different provider account cannot reuse the previous credentials cache', async () => {
    await storeTokens('customer-a', connector, { accessToken: 'old-token' });
    await connectorRequest('customer-a', connector, definition, 'read');
    await storeTokens('customer-a', connector, { accessToken: 'new-token' });
    const result = await connectorRequest('customer-a', connector, definition, 'read');
    expect(result.account).toBe('Bearer new-token');
    expect(axios).toHaveBeenCalledTimes(2);
  });
  test('legacy shared cache entries are ignored', async () => {
    await storeTokens('customer-a', connector, { accessToken: 'token-a' });
    await cache.set(`connector:${connector}:read:{}`, { account: 'someone-else' }, 300, 'connector');
    const result = await connectorRequest('customer-a', connector, definition, 'read');
    expect(result.account).toBe('Bearer token-a');
    expect(axios).toHaveBeenCalledTimes(1);
  });
  test('cache keys contain no raw credentials, customer identity or private query values', async () => {
    await storeTokens('private-customer-id', connector, { accessToken: 'private-provider-token' });
    const write = jest.spyOn(cache, 'set');
    await connectorRequest('private-customer-id', connector, definition, 'read', { params: { email: 'private@example.com' } });
    const responseWrites = write.mock.calls.filter(([, , , prefix]) => prefix === 'connector');
    expect(responseWrites).toHaveLength(1);
    const key = responseWrites[0][0];
    expect(key).toMatch(/^response:v2:[a-f0-9]{64}$/);
    expect(key).not.toMatch(/private-customer-id|private-provider-token|private@example/);
  });
  test('requests without a customer identity bypass response caching', async () => {
    const publicDefinition = { ...definition, auth: { type: 'none' } };
    await connectorRequest(null, connector, publicDefinition, 'read');
    await connectorRequest(null, connector, publicDefinition, 'read');
    expect(axios).toHaveBeenCalledTimes(2);
  });
  test('distinct query parameters do not collide, and false response bodies remain cacheable', async () => {
    await storeTokens('customer-a', connector, { accessToken: 'token-a' });
    axios.mockResolvedValue({ data: false });
    expect(await connectorRequest('customer-a', connector, definition, 'read', { params: { page: 1 } })).toBe(false);
    expect(await connectorRequest('customer-a', connector, definition, 'read', { params: { page: 1 } })).toBe(false);
    expect(axios).toHaveBeenCalledTimes(1);
    await connectorRequest('customer-a', connector, definition, 'read', { params: { page: 2 } });
    expect(axios).toHaveBeenCalledTimes(2);
  });

});
