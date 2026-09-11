/** Per-user ownership helpers. Client list/get must never return another user's records. */

export function userIdOf(req) {
  return req.user?.id || req.userId || null;
}

export function isOwnedBy(item, userId) {
  if (!item || !userId) return false;
  return item.owner === userId || item.userId === userId || item.user === userId;
}

export async function asList(value) {
  const v = await value;
  if (Array.isArray(v)) return v;
  return [];
}

export async function listOwned(value, userId) {
  const list = await asList(value);
  return list.filter((item) => isOwnedBy(item, userId));
}

export function publicAgent(agent) {
  if (!agent) return null;
  return {
    id: agent.id || agent.agentId,
    agentId: agent.agentId,
    name: agent.name,
    category: agent.category,
    status: agent.status,
    role: agent.role,
    lastActive: agent.lastActive,
    owner: agent.owner || null,
    system: !agent.owner,
  };
}
