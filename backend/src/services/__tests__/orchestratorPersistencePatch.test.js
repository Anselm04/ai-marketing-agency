import { beforeEach, describe, expect, test, jest } from '@jest/globals';

const records = [];
const createContent = jest.fn(async (value) => {
  const row = { id: `rec-${records.length + 1}`, ...value };
  records.push(row);
  return row;
});
const getContentByOwner = jest.fn(async (ownerId) => records.filter((item) => item.owner === ownerId || item.ownerId === ownerId));
const updateContent = jest.fn(async (id, patch) => {
  const row = records.find((item) => item.id === id);
  Object.assign(row, patch);
  return { ...row };
});
const deleteContent = jest.fn(async (id) => {
  const index = records.findIndex((item) => item.id === id);
  if (index < 0) return false;
  records.splice(index, 1);
  return true;
});
const getTokens = jest.fn(async () => null);
const getUserConnectorHealth = jest.fn(() => ({ status: 'unknown', lastChecked: null }));
const installOrchestratorConnectorHealthPatch = jest.fn((service) => service);
const installOrchestratorAiFallbackPatch = jest.fn((service) => service);
const sharedClassification = { category: 'marketing', complexity: 'medium', urgency: 'medium' };

jest.unstable_mockModule('../../utils/store.js', () => ({
  default: { createContent, getContentByOwner, updateContent, deleteContent },
}));
jest.unstable_mockModule('../appConnector.js', () => ({ getTokens, checkRateLimit: jest.fn(() => true) }));
jest.unstable_mockModule('../connectorUserHealthService.js', () => ({ getUserConnectorHealth }));
jest.unstable_mockModule('../orchestratorConnectorHealthPatch.js', () => ({ installOrchestratorConnectorHealthPatch }));
jest.unstable_mockModule('../orchestratorAiFallbackPatch.js', () => ({ installOrchestratorAiFallbackPatch }));
jest.unstable_mockModule('../connectors/index.js', () => ({
  allConnectors: [{ id: 'connector-a', name: 'Connector A', category: 'crm' }],
}));

const fakeService = {
  userProfiles: new Map(),
  taskHistory: new Map(),
  classifyTask(_taskType, content = '') {
    if (String(content).length > 10000) sharedClassification.complexity = 'high';
    else if (String(content).length > 3000) sharedClassification.complexity = 'medium';
    else sharedClassification.complexity = 'low';
    return sharedClassification;
  },
  async buildUserProfile(userId, data) {
    const profile = { userId, ...data, connectedConnectors: [], lastUpdated: Date.now() };
    this.userProfiles.set(userId, profile);
    return profile;
  },
  async logTaskHistory(userId, taskType, data) {
    const history = this.taskHistory.get(userId) || [];
    history.push({ taskType, ...data, timestamp: new Date().toISOString() });
    this.taskHistory.set(userId, history);
  },
};

const { installOrchestratorPersistencePatch } = await import('../orchestratorPersistencePatch.js');
installOrchestratorPersistencePatch(fakeService);

beforeEach(() => {
  records.splice(0, records.length);
  fakeService.userProfiles.clear();
  fakeService.taskHistory.clear();
  sharedClassification.complexity = 'medium';
  getTokens.mockReset();
  getTokens.mockResolvedValue(null);
  getUserConnectorHealth.mockReset();
  getUserConnectorHealth.mockReturnValue({ status: 'unknown', lastChecked: null });
  createContent.mockClear();
  getContentByOwner.mockClear();
  updateContent.mockClear();
  deleteContent.mockClear();
});

describe('orchestrator durable persistence', () => {
  test('installs tenant-safe connector and bounded AI fallback patches', () => {
    expect(installOrchestratorConnectorHealthPatch).toHaveBeenCalledWith(fakeService);
    expect(installOrchestratorAiFallbackPatch).toHaveBeenCalledWith(fakeService);
  });

  test('returns a usable default profile on first use even before profile setup', async () => {
    getTokens.mockResolvedValueOnce({ accessToken: 'user-token' });
    const profile = await fakeService.getUserProfile('new-user');
    expect(profile).toMatchObject({
      userId: 'new-user',
      industry: 'general',
      persisted: false,
      connectedConnectors: [expect.objectContaining({ id: 'connector-a' })],
    });
  });

  test('persists and restores a customer profile from durable storage', async () => {
    await fakeService.buildUserProfile('user-a', { industry: 'agency', goals: ['growth'] });
    fakeService.userProfiles.clear();

    const profile = await fakeService.getUserProfile('user-a');
    expect(profile).toMatchObject({ userId: 'user-a', industry: 'agency', goals: ['growth'], persisted: true });
    expect(records.some((item) => item.kind === 'orchestrator_user_profile')).toBe(true);
  });

  test('refreshes connected connector ownership from the current users stored token', async () => {
    await fakeService.buildUserProfile('user-a', { industry: 'agency' });
    getTokens.mockResolvedValueOnce({ accessToken: 'user-token' });
    const profile = await fakeService.getUserProfile('user-a');
    expect(profile.connectedConnectors).toEqual([
      expect.objectContaining({
        id: 'connector-a',
        health: expect.objectContaining({ status: 'connected_unverified' }),
      }),
    ]);
  });

  test('preserves an explicit tenant authorization failure instead of treating the connector as healthy', async () => {
    await fakeService.buildUserProfile('user-a', { industry: 'agency' });
    getTokens.mockResolvedValueOnce({ accessToken: 'user-token' });
    getUserConnectorHealth.mockReturnValueOnce({ status: 'authorization_failed', lastChecked: Date.now() });
    const profile = await fakeService.getUserProfile('user-a');
    expect(profile.connectedConnectors[0].health.status).toBe('authorization_failed');
  });

  test('returns a fresh classification per request instead of leaking complexity between customers', () => {
    const long = fakeService.classifyTask('campaign-strategy', 'x'.repeat(12000));
    const short = fakeService.classifyTask('campaign-strategy', 'short');
    expect(long).toMatchObject({ complexity: 'high' });
    expect(short).toMatchObject({ complexity: 'low' });
    expect(long).not.toBe(short);
    expect(long.complexity).toBe('high');
  });

  test('writes task history durably and reads only that owners history', async () => {
    await fakeService.logTaskHistory('user-a', 'content-generation', { status: 'success', modelId: 'model-a', cost: 0.1 });
    await fakeService.logTaskHistory('user-b', 'content-generation', { status: 'error', modelId: 'model-b', cost: 0.2 });

    const history = await fakeService.getTaskHistory('user-a', 50);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ taskType: 'content-generation', status: 'success', modelId: 'model-a', cost: 0.1 });
  });
});
