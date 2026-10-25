import { afterEach, describe, expect, jest, test } from '@jest/globals';
const connectorRequest = jest.fn();
const addJob = jest.fn();
const definitions = {
  first: { id: 'first', operations: [{ id: 'read', method: 'GET' }, { id: 'publish', method: 'POST' }] },
  second: { id: 'second', operations: [{ id: 'read', method: 'GET' }, { id: 'publish', method: 'POST' }] },
};
jest.unstable_mockModule('../services/appConnector.js', () => ({ connectorRequest, getTokens: jest.fn(), getHealthStatus: jest.fn(), checkRateLimit: jest.fn() }));
jest.unstable_mockModule('../services/connectors/index.js', () => ({ allConnectors: [], getConnectorById: (id) => definitions[id] }));
jest.unstable_mockModule('../utils/queue.js', () => ({ addJob, QueueNames: { CONNECTOR_SYNC: 'connector-sync' } }));
const { IntelligentOrchestrator } = await import('../services/intelligentOrchestrator.js');
afterEach(() => jest.clearAllMocks());
function orchestrator() {
  const instance = new IntelligentOrchestrator();
  jest.spyOn(instance, 'selectConnectors').mockResolvedValue({ selected: [{ id: 'first' }, { id: 'second' }] });
  jest.spyOn(instance, 'logTaskHistory').mockResolvedValue();
  return instance;
}
const transient = () => Object.assign(new Error('provider failed'), { response: { status: 503 } });
describe('connector fallback termination', () => {
  test('a failed read tries the next distinct connector once', async () => {
    const service = orchestrator();
    connectorRequest.mockRejectedValueOnce(transient()).mockResolvedValue({ ok: true });
    const result = await service.executeConnectorTask('user-1', 'analytics', 'read');
    expect(result.orchestration.selectedConnector).toBe('second');
    expect(connectorRequest.mock.calls.map((args) => args[1])).toEqual(['first', 'second']);
    expect(service.selectConnectors).toHaveBeenCalledTimes(1);
  });
  test('all failures terminate without unprocessed background jobs', async () => {
    const service = orchestrator();
    connectorRequest.mockRejectedValue(transient());
    // Catch the old recursive defect promptly, without hanging the suite.
    service.selectConnectors.mockImplementation(async () => {
      if (service.selectConnectors.mock.calls.length > 2) throw new Error('recursive selection detected');
      return { selected: [{ id: 'first' }, { id: 'second' }] };
    });
    await expect(service.executeConnectorTask('user-1', 'analytics', 'read')).rejects.toMatchObject({ retryQueued: false, backgroundRetryAvailable: false });
    expect(connectorRequest).toHaveBeenCalledTimes(2);
    expect(addJob).not.toHaveBeenCalled();
  });
  test('a failed write does not fail over to another account or enqueue an automatic replay', async () => {
    connectorRequest.mockRejectedValue(transient());
    const service = orchestrator();
    service.selectConnectors.mockResolvedValueOnce({ selected: [{ id: 'first' }, { id: 'second' }] }).mockResolvedValue({ selected: [] });
    await expect(service.executeConnectorTask('user-1', 'social', 'publish')).rejects.toMatchObject({ retryQueued: false, backgroundRetryAvailable: false });
    expect(connectorRequest).toHaveBeenCalledTimes(1);
    expect(addJob).not.toHaveBeenCalled();
  });
  test('permanent failures do not switch connected accounts', async () => {
    connectorRequest.mockRejectedValue(Object.assign(new Error('reconnect required'), { response: { status: 401 } }));
    await expect(orchestrator().executeConnectorTask('user-1', 'analytics', 'read')).rejects.toThrow('reconnect required');
    expect(connectorRequest).toHaveBeenCalledTimes(1);
  });
  test('duplicate connector entries are attempted once', async () => {
    const service = orchestrator();
    service.selectConnectors.mockResolvedValue({ selected: [{ id: 'first' }, { id: 'first' }, { id: 'second' }] });
    connectorRequest.mockRejectedValue(transient());
    await expect(service.executeConnectorTask('user-1', 'analytics', 'read')).rejects.toThrow('provider failed');
    expect(connectorRequest.mock.calls.map((args) => args[1])).toEqual(['first', 'second']);
  });
  test('a history error cannot turn a successful write into a replay', async () => {
    const service = orchestrator();
    service.logTaskHistory.mockRejectedValue(new Error('history unavailable'));
    connectorRequest.mockResolvedValue({ externalId: 'posted-once' });
    expect(await service.executeConnectorTask('user-1', 'social', 'publish')).toMatchObject({ externalId: 'posted-once' });
    expect(connectorRequest).toHaveBeenCalledTimes(1);
    expect(addJob).not.toHaveBeenCalled();
  });
  test('campaign failures disclose unavailable background retries', async () => {
    connectorRequest.mockRejectedValue(transient());
    const result = await orchestrator().executeCampaignOrchestration('user-1', { taskType: 'social', connectorOperations: [{ operation: 'publish', payload: {} }] });
    expect(result.connectors).toEqual([expect.objectContaining({ success: false, retryQueued: false, backgroundRetryAvailable: false })]);
    expect(result.errors[0]).toMatchObject({ retryQueued: false, backgroundRetryAvailable: false });
  });

});
