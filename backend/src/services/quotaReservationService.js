import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;
let pool = null;
const memoryReservations = new Map();

function databaseUrl() {
  if (process.env.NODE_ENV === 'test' && process.env.USAGE_METERING_TEST_DATABASE !== 'true') return null;
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;
}

function getPool() {
  if (pool) return pool;
  const connectionString = databaseUrl();
  if (!connectionString) return null;
  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.USAGE_DB_POOL_MAX || 2),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return pool;
}

function quotaError(resource, used, requested, limit) {
  return Object.assign(new Error(`${resource} limit reached.`), {
    status: 402,
    code: 'plan_quota_exceeded',
    resource,
    quota: {
      used,
      requested,
      limit,
      remaining: Math.max(0, Number(limit) - Number(used)),
    },
  });
}

export async function reserveUsageQuota({
  userId,
  metric,
  requested,
  limit,
  windowStart,
  windowEnd,
  resource,
  ttlSeconds = 120,
}) {
  if (limit === Infinity) return { id: null, unlimited: true };
  const quantity = Number(requested);
  if (!userId || !metric || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Invalid quota reservation request');
  }

  const id = crypto.randomUUID();
  const db = getPool();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  if (!db) {
    for (const [key, value] of memoryReservations.entries()) {
      if (new Date(value.expiresAt) <= now) memoryReservations.delete(key);
    }
    const reserved = [...memoryReservations.values()]
      .filter((r) => r.userId === userId && r.metric === metric && r.windowStart === windowStart && r.windowEnd === windowEnd)
      .reduce((sum, r) => sum + r.quantity, 0);
    const used = 0;
    if (used + reserved + quantity > limit) throw quotaError(resource, used + reserved, quantity, limit);
    memoryReservations.set(id, { id, userId, metric, quantity, windowStart, windowEnd, expiresAt });
    return { id, quantity, reserved, expiresAt };
  }

  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`${userId}:${metric}:${windowStart}:${windowEnd}`]);
    await client.query('delete from marketing.quota_reservations where expires_at <= now()');

    const usage = await client.query(
      `select coalesce(sum(quantity), 0)::double precision as total
         from marketing.usage_events
        where user_id = $1 and metric = $2 and created_at >= $3 and created_at < $4`,
      [userId, metric, windowStart, windowEnd],
    );
    const reservations = await client.query(
      `select coalesce(sum(quantity), 0)::double precision as total
         from marketing.quota_reservations
        where user_id = $1 and metric = $2 and window_start = $3 and window_end = $4 and expires_at > now()`,
      [userId, metric, windowStart, windowEnd],
    );
    const used = Number(usage.rows[0]?.total || 0);
    const reserved = Number(reservations.rows[0]?.total || 0);
    if (used + reserved + quantity > limit) {
      throw quotaError(resource, used + reserved, quantity, limit);
    }

    await client.query(
      `insert into marketing.quota_reservations
        (id, user_id, metric, quantity, window_start, window_end, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, userId, metric, quantity, windowStart, windowEnd, expiresAt],
    );
    await client.query('commit');
    return { id, quantity, used, reserved, expiresAt };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseQuotaReservation(id) {
  if (!id) return;
  const db = getPool();
  if (!db) {
    memoryReservations.delete(id);
    return;
  }
  await db.query('delete from marketing.quota_reservations where id = $1', [id]);
}

export function resetQuotaReservationsForTests() {
  memoryReservations.clear();
}
