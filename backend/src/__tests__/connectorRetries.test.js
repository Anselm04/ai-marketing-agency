import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
const axios = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: axios }));
const { connectorRequest } = await import('../services/appConnector.js');
let serial = 0;
beforeEach(() => { axios.mockReset(); jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());
const failure = (status = 503, code) => Object.assign(new Error('provider failed'), { response: status ? { status } : undefined, code });
async function run(method = 'GET', retries = 1) {
  const definition = { auth: { type: 'none' }, baseUrl: 'https://provider.example', operations: [{ id: 'op', method, url: '/resource', retries }] };
  // Attach a rejection handler immediately while fake timers advance.
  const settled = connectorRequest('user-1', `retry-${++serial}`, definition, 'op').then((value) => ({ value }), (error) => ({ error }));
  await jest.runAllTimersAsync();
  return settled;
}
describe('bounded connector request retries', () => {
  test('a transient GET failure retries and returns its successful result', async () => {
    axios.mockRejectedValueOnce(failure()).mockResolvedValueOnce({ data: { ok: true } });
    expect((await run()).value).toEqual({ ok: true });
    expect(axios).toHaveBeenCalledTimes(2);
  });
  test('an explicit zero disables retries', async () => {
    axios.mockRejectedValue(failure());
    expect((await run('GET', 0)).error).toBeDefined();
    expect(axios).toHaveBeenCalledTimes(1);
  });
  test('permanent GET errors are not retried', async () => {
    axios.mockRejectedValue(failure(401, 'ECONNRESET'));
    expect((await run('GET', 3)).error).toBeDefined();
    expect(axios).toHaveBeenCalledTimes(1);
  });
  test.each(['POST', 'PATCH', 'PUT', 'DELETE'])('does not automatically repeat a %s after an ambiguous timeout', async (method) => {
    axios.mockRejectedValue(failure(null, 'ETIMEDOUT'));
    expect((await run(method, 3)).error).toBeDefined();
    expect(axios).toHaveBeenCalledTimes(1);
  });
  test('caps excessive read retries at three additional attempts', async () => {
    axios.mockRejectedValue(failure());
    expect((await run('GET', 5)).error).toBeDefined();
    expect(axios).toHaveBeenCalledTimes(4);
  });
});
