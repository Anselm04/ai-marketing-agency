import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

const localLocks = new Map();

async function withLocalLock(key, task) {
  const previous = localLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  localLocks.set(key, previous.then(() => current));

  await previous;
  try {
    return await task();
  } finally {
    release();
    if (localLocks.get(key) === current) localLocks.delete(key);
  }
}

export async function withEcosystemLock(key, task) {
  if (!pool) return withLocalLock(key, task);

  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock(hashtext($1))', [key]);
    return await task();
  } finally {
    try {
      await client.query('select pg_advisory_unlock(hashtext($1))', [key]);
    } finally {
      client.release();
    }
  }
}
