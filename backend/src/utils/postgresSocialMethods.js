/**
 * Attach OAuth/social/media store methods for PostgreSQL (marketing.* schema).
 * Used by store.js so Social OAuth status/callback work after Postgres gate.
 */
import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;

const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
const nowIso = () => new Date().toISOString();
const stripUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));

function entity(row) {
  if (!row) return null;
  const base = row.data || {};
  return {
    ...base,
    id: row.id,
    ...(row.owner_id ? { ownerId: row.owner_id, owner: base.owner ?? row.owner_id } : {}),
    createdAt: row.created_at?.toISOString?.() || row.created_at || base.createdAt,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at || base.updatedAt,
  };
}

function connectionRow(row) {
  if (!row) return null;
  return {
    ...(row.data || {}),
    id: row.id,
    owner: row.owner_id,
    platform: row.platform,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

export function attachPostgresSocialMethods(store) {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    throw new Error('DATABASE_URL or SUPABASE_DB_URL required for social Postgres methods');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  async function listEntities(table) {
    const { rows } = await pool.query(`select * from marketing.${table} order by created_at desc`);
    return rows.map(entity);
  }
  async function getEntity(table, entityId) {
    const { rows } = await pool.query(`select * from marketing.${table} where id = $1 limit 1`, [entityId]);
    return entity(rows[0]);
  }
  async function createEntity(table, payload, extra = {}) {
    const entityId = payload.id || id();
    const createdAt = payload.createdAt || nowIso();
    const data = stripUndefined({ ...payload, id: undefined, createdAt: undefined, updatedAt: undefined });
    const columns = ['id', 'data', 'created_at', 'updated_at'];
    const values = [entityId, data, createdAt, createdAt];
    for (const [column, value] of Object.entries(extra)) {
      columns.push(column);
      values.push(value ?? null);
    }
    const params = values.map((_, index) => `$${index + 1}`).join(', ');
    const { rows } = await pool.query(
      `insert into marketing.${table} (${columns.join(', ')}) values (${params}) returning *`,
      values,
    );
    return entity(rows[0]);
  }
  async function updateEntity(table, entityId, updates, extra = {}) {
    const current = await getEntity(table, entityId);
    if (!current) return null;
    const merged = { ...current, ...updates, id: entityId };
    delete merged.createdAt;
    delete merged.updatedAt;
    const sets = ['data = $2::jsonb', 'updated_at = now()'];
    const values = [entityId, merged];
    let index = 3;
    for (const [column, value] of Object.entries(extra)) {
      sets.push(`${column} = $${index}`);
      values.push(value ?? null);
      index += 1;
    }
    const { rows } = await pool.query(
      `update marketing.${table} set ${sets.join(', ')} where id = $1 returning *`,
      values,
    );
    return entity(rows[0]);
  }
  async function deleteEntity(table, entityId) {
    const result = await pool.query(`delete from marketing.${table} where id = $1`, [entityId]);
    return result.rowCount > 0;
  }

  Object.assign(store, {
    getPersistenceInfo() {
      return {
        mode: 'supabase-postgres',
        durable: true,
        databaseUrlConfigured: true,
        schema: 'marketing',
        note: 'Using PostgreSQL (DATABASE_URL / SUPABASE_DB_URL) against marketing.* schema.',
      };
    },

    async getSocialConnectionsByOwner(userId) {
      if (!userId) return [];
      const { rows } = await pool.query(
        'select * from marketing.social_connections where owner_id = $1 order by created_at desc',
        [userId],
      );
      return rows.map(connectionRow);
    },

    async upsertSocialConnection(userId, platform, extra = {}) {
      const plat = String(platform || '').toLowerCase();
      const { rows: existing } = await pool.query(
        'select * from marketing.social_connections where owner_id = $1 and platform = $2 limit 1',
        [userId, plat],
      );
      const prev = existing[0];
      const mergedData = stripUndefined({
        ...(prev?.data || {}),
        ...extra,
        owner: userId,
        platform: plat,
        status: extra.status || prev?.data?.status || 'needs_token',
        tokenSet: extra.tokenSet != null ? !!extra.tokenSet : !!prev?.data?.tokenSet,
      });
      delete mergedData.id;
      delete mergedData.createdAt;
      delete mergedData.updatedAt;

      if (!prev) {
        const rowId = id();
        const { rows } = await pool.query(
          `insert into marketing.social_connections (id, owner_id, platform, data, created_at, updated_at)
           values ($1, $2, $3, $4::jsonb, now(), now()) returning *`,
          [rowId, userId, plat, mergedData],
        );
        return connectionRow(rows[0]);
      }

      const { rows } = await pool.query(
        `update marketing.social_connections
         set data = $3::jsonb, updated_at = now()
         where owner_id = $1 and platform = $2 returning *`,
        [userId, plat, mergedData],
      );
      return connectionRow(rows[0]);
    },

    async deleteSocialConnection(connectionId, userId) {
      const { rows } = await pool.query(
        'select * from marketing.social_connections where id = $1 limit 1',
        [connectionId],
      );
      const row = rows[0];
      if (!row) return false;
      if (userId && row.owner_id !== userId) return false;
      const result = await pool.query('delete from marketing.social_connections where id = $1', [connectionId]);
      return result.rowCount > 0;
    },

    getAllSocialPosts() { return listEntities('social_posts'); },
    async getSocialPostsByOwner(userId) {
      const { rows } = await pool.query(
        'select * from marketing.social_posts where owner_id = $1 order by created_at desc',
        [userId],
      );
      return rows.map(entity);
    },
    async getSocialPostById(postId, userId) {
      const row = await getEntity('social_posts', postId);
      if (!row) return null;
      if (userId && row.owner !== userId && row.ownerId !== userId) return null;
      return row;
    },
    createSocialPost(item) {
      return createEntity('social_posts', { status: item.status || 'draft', ...item }, {
        owner_id: item.ownerId || item.owner || null,
      });
    },
    async updateSocialPost(postId, updates, userId) {
      const current = await getEntity('social_posts', postId);
      if (!current) return null;
      if (userId && current.owner !== userId && current.ownerId !== userId) return null;
      const next = { ...updates };
      if (next && 'owner' in next) delete next.owner;
      return updateEntity('social_posts', postId, next, {
        owner_id: next.ownerId || current.ownerId || current.owner || null,
      });
    },
    async deleteSocialPost(postId, userId) {
      const current = await getEntity('social_posts', postId);
      if (!current) return false;
      if (userId && current.owner !== userId && current.ownerId !== userId) return false;
      return deleteEntity('social_posts', postId);
    },

    getAllVideos() { return listEntities('videos'); },
    async getVideosByOwner(userId) {
      const { rows } = await pool.query(
        'select * from marketing.videos where owner_id = $1 order by created_at desc',
        [userId],
      );
      return rows.map(entity);
    },
    async getVideoById(videoId, userId) {
      const row = await getEntity('videos', videoId);
      if (!row) return null;
      if (userId && row.owner !== userId && row.ownerId !== userId) return null;
      return row;
    },
    createVideo(item) {
      return createEntity('videos', item, { owner_id: item.ownerId || item.owner || null });
    },
    async updateVideo(videoId, updates, userId) {
      const current = await getEntity('videos', videoId);
      if (!current) return null;
      if (userId && current.owner !== userId && current.ownerId !== userId) return null;
      const next = { ...updates };
      if (next && 'owner' in next) delete next.owner;
      return updateEntity('videos', videoId, next, {
        owner_id: next.ownerId || current.ownerId || current.owner || null,
      });
    },
    async deleteVideo(videoId, userId) {
      const current = await getEntity('videos', videoId);
      if (!current) return false;
      if (userId && current.owner !== userId && current.ownerId !== userId) return false;
      return deleteEntity('videos', videoId);
    },

    async getAvatarsByOwner(userId) {
      const { rows } = await pool.query(
        'select * from marketing.avatars where owner_id = $1 order by created_at desc',
        [userId],
      );
      return rows.map(entity);
    },
    async getAvatarById(avatarId, userId) {
      const row = await getEntity('avatars', avatarId);
      if (!row) return null;
      if (userId && row.owner !== userId && row.ownerId !== userId) return null;
      return row;
    },
    createAvatar(item) {
      return createEntity('avatars', item, { owner_id: item.ownerId || item.owner || null });
    },
    async deleteAvatar(avatarId, userId) {
      const current = await getEntity('avatars', avatarId);
      if (!current) return false;
      if (userId && current.owner !== userId && current.ownerId !== userId) return false;
      return deleteEntity('avatars', avatarId);
    },

    async getAdPacksByOwner(userId) {
      const { rows } = await pool.query(
        'select * from marketing.ad_packs where owner_id = $1 order by created_at desc',
        [userId],
      );
      return rows.map(entity);
    },
    async getAdPackById(packId, userId) {
      const row = await getEntity('ad_packs', packId);
      if (!row) return null;
      if (userId && row.owner !== userId && row.ownerId !== userId) return null;
      return row;
    },
    createAdPack(item) {
      return createEntity('ad_packs', item, { owner_id: item.ownerId || item.owner || null });
    },
    async deleteAdPack(packId, userId) {
      const current = await getEntity('ad_packs', packId);
      if (!current) return false;
      if (userId && current.owner !== userId && current.ownerId !== userId) return false;
      return deleteEntity('ad_packs', packId);
    },

    async getAdSpendByOwner(userId) {
      const { rows } = await pool.query(
        'select * from marketing.ad_spend where owner_id = $1 order by created_at desc',
        [userId],
      );
      return rows.map(entity);
    },
    createAdSpend(item) {
      return createEntity(
        'ad_spend',
        { ...item, at: item.at || nowIso() },
        { owner_id: item.ownerId || item.owner || null },
      );
    },
  });

  return store;
}

export default { attachPostgresSocialMethods };
