import store from '../utils/store.js';
import { allConnectors } from './connectors/index.js';
import { getHealthStatus, getTokens } from './appConnector.js';
import { intelligentOrchestrator } from './intelligentOrchestrator.js';

const PROFILE_KIND = 'orchestrator_user_profile';
const HISTORY_KIND = 'orchestrator_task_history';
const MAX_HISTORY = 1000;

function sanitizeProfile(profile = {}) {
  return {
    userId: profile.userId,
    industry: profile.industry || 'general',
    companySize: profile.companySize || 'small',
    budget: profile.budget || 'standard',
    goals: Array.isArray(profile.goals) ? profile.goals.slice(0, 50) : [],
    preferredTone: profile.preferredTone || 'professional',
    language: profile.language || 'en',
    timezone: profile.timezone || 'UTC',
    aiPreferences: profile.aiPreferences && typeof profile.aiPreferences === 'object' ? profile.aiPreferences : {},
    lastUpdated: profile.lastUpdated || Date.now(),
  };
}

async function connectedConnectorsForUser(userId) {
  const connected = [];
  for (const connector of allConnectors) {
    const tokens = await getTokens(userId, connector.id);
    if (!tokens?.accessToken) continue;
    connected.push({
      id: connector.id,
      name: connector.name,
      category: connector.category,
      health: getHealthStatus(connector.id),
    });
  }
  return connected;
}

async function upsertProfile(userId, profile) {
  const owned = await store.getContentByOwner(userId);
  const current = owned.find((item) => item.kind === PROFILE_KIND);
  const payload = {
    kind: PROFILE_KIND,
    owner: userId,
    ownerId: userId,
    profile: sanitizeProfile(profile),
    updatedAt: new Date().toISOString(),
  };
  return current
    ? store.updateContent(current.id, payload)
    : store.createContent({ ...payload, createdAt: new Date().toISOString() });
}

export function installOrchestratorPersistencePatch(service = intelligentOrchestrator) {
  if (!service || service.__persistencePatchApplied) return service;

  const originalBuild = service.buildUserProfile.bind(service);
  const originalLog = service.logTaskHistory.bind(service);

  service.buildUserProfile = async function buildPersistentUserProfile(userId, userData = {}) {
    const profile = await originalBuild(userId, userData);
    await upsertProfile(userId, profile);
    return profile;
  };

  service.getUserProfile = async function getPersistentUserProfile(userId) {
    const owned = await store.getContentByOwner(userId);
    const record = owned.find((item) => item.kind === PROFILE_KIND);
    if (!record?.profile) return null;

    const profile = {
      ...sanitizeProfile(record.profile),
      connectedConnectors: await connectedConnectorsForUser(userId),
    };
    // Keep the runtime map only as a non-authoritative accelerator for legacy
    // internal code; persistence remains the source of truth.
    service.userProfiles?.set(userId, profile);
    return profile;
  };

  service.logTaskHistory = async function logPersistentTaskHistory(userId, taskType, data = {}) {
    const timestamp = new Date().toISOString();
    await originalLog(userId, taskType, data).catch(() => {});
    await store.createContent({
      kind: HISTORY_KIND,
      owner: userId,
      ownerId: userId,
      taskType: String(taskType || '').slice(0, 200),
      status: data.status || null,
      modelId: data.modelId || null,
      providerId: data.providerId || null,
      connectorId: data.connectorId || null,
      duration: Number.isFinite(Number(data.duration)) ? Number(data.duration) : null,
      cost: Number.isFinite(Number(data.cost)) ? Number(data.cost) : null,
      error: data.error ? String(data.error).slice(0, 2000) : null,
      metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
      timestamp,
      createdAt: timestamp,
    });

    // Bound durable history to the same 1000-record contract used by the old
    // in-memory implementation.
    const owned = (await store.getContentByOwner(userId))
      .filter((item) => item.kind === HISTORY_KIND)
      .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
    for (const stale of owned.slice(MAX_HISTORY)) {
      await store.deleteContent(stale.id);
    }
  };

  service.getTaskHistory = async function getPersistentTaskHistory(userId, limit = 50) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, MAX_HISTORY));
    const owned = await store.getContentByOwner(userId);
    return owned
      .filter((item) => item.kind === HISTORY_KIND)
      .sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt))
      .slice(-safeLimit)
      .map((item) => ({
        taskType: item.taskType,
        status: item.status,
        modelId: item.modelId,
        providerId: item.providerId,
        connectorId: item.connectorId,
        duration: item.duration,
        cost: item.cost,
        error: item.error,
        timestamp: item.timestamp || item.createdAt,
      }));
  };

  Object.defineProperty(service, '__persistencePatchApplied', {
    value: true,
    enumerable: false,
  });
  return service;
}

export { HISTORY_KIND as ORCHESTRATOR_HISTORY_KIND, PROFILE_KIND as ORCHESTRATOR_PROFILE_KIND };
export default installOrchestratorPersistencePatch;
