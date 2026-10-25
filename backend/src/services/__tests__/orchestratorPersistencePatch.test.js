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
const getHealthStatus = jest.fn(() => ({ status: 'unknown' }));

jest.unstable_mockModule('../../utils/store.js', () => ({
  default: { createContent, getContentByOwner, updateContent, deleteContent },
}));
jest.unstable_mockModule('../appConnector.js', () => ({
  getTokens,
  getHealthStatus,
}));
jest.unstable_mockModule('../connectors/index.js', () => ({
  allConnectors: [{ id: 'connector-a', name: 'Connector A', category: 'crm' }],
}));

const fakeService = {
  userProfiles: new Map(),
  taskHistory: new Map(),
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
  jest.clearAllMocks();
});

describe('orchestrator durable persistence', () => {
  test('persists and restores a customer profile from durable storage', async () => {
    await fakeService.buildUserProfile('user-a', { industry: 'agency', goals: ['growth'] });
    fakeService.userProfiles.clear();

    const profile = await fakeService.getUserProfile('user-a');
    expect(profile).toMatchObject({ userId: 'user-a', industry: 'agency', goals: ['growth'] });
    expect(records.some((item) => item.kind === 'orchestrator_user_profile')).toBe(true);
  });

  test('refreshes connected connector ownership from the current users stored token', async () => {
    await fakeService.buildUserProfile('user-a', { industry: 'agency' });
    getTokens.mockResolvedValueOnce({ accessToken: 'user-token' });
    const profile = await fakeService.getUserProfile('user-a');
    expect(profile.connectedConnectors).toEqual([expect.objectContaining({ id: 'connector-a' })]);
  });

  test('writes task history durably and reads only that owners history', async () => {
    await fakeService.logTaskHistory('user-a', 'content-generation', { status: 'success', modelId: 'model-a', cost: 0.1 });
    await fakeService.logTaskHistory('user-b', 'content-generation', { status: 'error', modelId: 'model-b', cost: 0.2 });

    const history = await fakeService.getTaskHistory('user-a', 50);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ taskType: 'content-generation', status: 'success', modelId: 'model-a', cost: 0.1 });
  });
});
