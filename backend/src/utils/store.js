import jsonStore from './jsonStore.js';

const hasPostgresUrl = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
const mustUsePostgres = process.env.NODE_ENV === 'production';

if (mustUsePostgres && !hasPostgresUrl) {
  throw new Error(
    'Production startup blocked: DATABASE_URL or SUPABASE_DB_URL is required for Marketing Agency PostgreSQL persistence.',
  );
}

const store = hasPostgresUrl
  ? (await import('./postgresStore.js')).default
  : jsonStore;

if (hasPostgresUrl) {
  const { attachPostgresSocialMethods } = await import('./postgresSocialMethods.js');
  attachPostgresSocialMethods(store);
} else if (typeof store.getSocialConnectionsByOwner !== 'function') {
  // Dev/test JSON fallback for Social OAuth metadata (non-durable).
  const socialConnections = [];
  const owned = (list, userId) => (list || []).filter((item) => item && (item.owner === userId || item.userId === userId));
  store.getPersistenceInfo = () => ({
    mode: 'json-ephemeral',
    durable: false,
    databaseUrlConfigured: false,
    note: 'JSON file adapter (dev/test). Set DATABASE_URL for Postgres.',
  });
  store.getSocialConnectionsByOwner = (userId) => Promise.resolve(owned(socialConnections, userId));
  store.upsertSocialConnection = (userId, platform, extra = {}) => {
    const plat = String(platform || '').toLowerCase();
    let row = socialConnections.find((c) => c.owner === userId && c.platform === plat);
    if (!row) {
      row = {
        id: store._id ? store._id() : `${Date.now()}`,
        owner: userId,
        platform: plat,
        status: extra.status || 'needs_token',
        tokenSet: !!extra.tokenSet,
        createdAt: new Date().toISOString(),
        ...extra,
      };
      socialConnections.push(row);
    } else {
      Object.assign(row, extra, { owner: userId, platform: plat });
    }
    return row;
  };
  store.deleteSocialConnection = (connectionId, userId) => {
    const idx = socialConnections.findIndex((c) => c.id === connectionId);
    if (idx === -1) return false;
    if (userId && socialConnections[idx].owner !== userId) return false;
    socialConnections.splice(idx, 1);
    return true;
  };
}

export default store;
