import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;
const requestCounts = new Map();
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000;
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100;
let pool = null;

function databaseUrl() {
  if (process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_TEST_DATABASE !== 'true') return null;
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;
}

function getPool() {
  if (pool) return pool;
  const connectionString = databaseUrl();
  if (!connectionString) return null;
  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.RATE_LIMIT_DB_POOL_MAX || 2),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return pool;
}

function validClientValue(value) {
  const text = String(value || '').trim();
  return text.length > 0 && text.length <= 200 ? text : null;
}

export function resolveRateLimitClientKey(req) {
  const flyClientIp = process.env.FLY_APP_NAME
    ? validClientValue(req.headers?.['fly-client-ip'])
    : null;
  return flyClientIp || validClientValue(req.ip) || validClientValue(req.socket?.remoteAddress) || 'unknown-client';
}

function hashKey(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function windowStartFor(now = Date.now()) {
  return new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS).toISOString();
}

function retryAfterSeconds(now = Date.now()) {
  const nextWindow = (Math.floor(now / WINDOW_MS) + 1) * WINDOW_MS;
  return Math.max(1, Math.ceil((nextWindow - now) / 1000));
}

function memoryLimit(key, now) {
  const windowStart = now - WINDOW_MS;
  const timestamps = requestCounts.get(key) || [];
  const recentRequests = timestamps.filter((timestamp) => timestamp > windowStart);
  if (recentRequests.length >= MAX_REQUESTS) {
    requestCounts.set(key, recentRequests);
    return false;
  }
  recentRequests.push(now);
  requestCounts.set(key, recentRequests);
  return true;
}

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestCounts.entries()) {
    const valid = timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);
    if (valid.length === 0) requestCounts.delete(key);
    else requestCounts.set(key, valid);
  }
}, 5 * 60 * 1000);
cleanupInterval.unref?.();

async function distributedCount(key, now) {
  const db = getPool();
  if (!db) return null;
  const windowStart = windowStartFor(now);
  const { rows } = await db.query(
    `insert into marketing.rate_limit_windows (key_hash, window_start, request_count, updated_at)
     values ($1, $2, 1, now())
     on conflict (key_hash, window_start)
     do update set request_count = marketing.rate_limit_windows.request_count + 1, updated_at = now()
     returning request_count`,
    [hashKey(key), windowStart],
  );

  if (Math.random() < 0.01) {
    db.query(
      'delete from marketing.rate_limit_windows where updated_at < now() - interval \'2 days\'',
    ).catch(() => {});
  }

  return Number(rows[0]?.request_count || 0);
}

export async function rateLimit(req, res, next) {
  const key = resolveRateLimitClientKey(req);
  const now = Date.now();

  try {
    const count = await distributedCount(key, now);
    if (count != null) {
      if (count > MAX_REQUESTS) {
        res.setHeader('Retry-After', String(retryAfterSeconds(now)));
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }
      return next();
    }

    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'Request protection is temporarily unavailable. Please try again shortly.',
        code: 'rate_limit_store_unavailable',
      });
    }

    if (!memoryLimit(key, now)) {
      res.setHeader('Retry-After', String(retryAfterSeconds(now)));
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    return next();
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'Request protection is temporarily unavailable. Please try again shortly.',
        code: 'rate_limit_store_unavailable',
      });
    }
    if (!memoryLimit(key, now)) return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    return next();
  }
}
