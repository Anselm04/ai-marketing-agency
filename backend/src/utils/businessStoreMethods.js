import pg from 'pg';

const { Pool } = pg;

function entity(row) {
  if (!row) return null;
  return {
    ...(row.data || {}),
    id: row.id,
    ownerId: row.owner_id,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

export function attachBusinessStoreMethods(store) {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

  if (connectionString) {
    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 4,
    });
    const originalDisconnect = typeof store.disconnectDB === 'function' ? store.disconnectDB.bind(store) : null;
    store.disconnectDB = async () => {
      await pool.end();
      if (originalDisconnect) await originalDisconnect();
    };

    store.getBusinessesByOwner = async (ownerId) => {
      const { rows } = await pool.query(
        'select * from marketing.businesses where owner_id = $1 order by created_at asc',
        [ownerId],
      );
      return rows.map(entity);
    };

    store.getBusinessById = async (businessId) => {
      const { rows } = await pool.query(
        'select * from marketing.businesses where id = $1 limit 1',
        [businessId],
      );
      return entity(rows[0]);
    };

    store.createBusiness = async (payload) => {
      const businessId = payload.id || store._id();
      const { ownerId, ...data } = payload;
      const { rows } = await pool.query(
        `insert into marketing.businesses (id, owner_id, data)
         values ($1, $2, $3::jsonb)
         returning *`,
        [businessId, ownerId, data],
      );
      return entity(rows[0]);
    };

    store.updateBusiness = async (businessId, updates) => {
      const current = await store.getBusinessById(businessId);
      if (!current) return null;
      const { id, ownerId, createdAt, updatedAt, ...currentData } = current;
      const { rows } = await pool.query(
        `update marketing.businesses
            set data = $2::jsonb, updated_at = now()
          where id = $1
          returning *`,
        [businessId, { ...currentData, ...updates }],
      );
      return entity(rows[0]);
    };

    store.deleteBusiness = async (businessId) => {
      const result = await pool.query('delete from marketing.businesses where id = $1', [businessId]);
      return result.rowCount > 0;
    };
    return;
  }

  const businesses = [];
  store.getBusinessesByOwner = async (ownerId) => businesses.filter((row) => row.ownerId === ownerId);
  store.getBusinessById = async (businessId) => businesses.find((row) => row.id === businessId) || null;
  store.createBusiness = async (payload) => {
    const now = new Date().toISOString();
    const row = { ...payload, id: payload.id || store._id(), createdAt: now, updatedAt: now };
    businesses.push(row);
    return row;
  };
  store.updateBusiness = async (businessId, updates) => {
    const index = businesses.findIndex((row) => row.id === businessId);
    if (index === -1) return null;
    businesses[index] = { ...businesses[index], ...updates, id: businessId, updatedAt: new Date().toISOString() };
    return businesses[index];
  };
  store.deleteBusiness = async (businessId) => {
    const index = businesses.findIndex((row) => row.id === businessId);
    if (index === -1) return false;
    businesses.splice(index, 1);
    return true;
  };
}
