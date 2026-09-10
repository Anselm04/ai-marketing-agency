import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const lockPool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

const localLocks = new Map();

async function withLocalLock(key, callback) {
  const previous = localLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  localLocks.set(key, previous.then(() => current));
  await previous;
  try {
    return await callback();
  } finally {
    release();
    if (localLocks.get(key) === current) localLocks.delete(key);
  }
}

export async function withEcosystemLock(key, callback) {
  if (!lockPool) return withLocalLock(key, callback);

  const client = await lockPool.connect();
  try {
    await client.query('select pg_advisory_lock(hashtextextended($1, 0))', [key]);
    return await callback();
  } finally {
    try {
      await client.query('select pg_advisory_unlock(hashtextextended($1, 0))', [key]);
    } finally {
      client.release();
    }
  }
}
