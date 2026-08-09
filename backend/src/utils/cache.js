/**
 * Redis Cache Service
 * Provides distributed caching with TTL, graceful fallback to in-memory Map.
 */

import IORedis from 'ioredis';
import { logger } from './logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const USE_REDIS_CACHE = process.env.USE_REDIS_CACHE !== 'false';
const DEFAULT_TTL = parseInt(process.env.CACHE_TTL_SECONDS, 10) || 300;

let redis = null;
let memoryCache = new Map();
let fallbackEnabled = false;

/**
 * Initialize Redis connection for caching.
 */
function getRedis() {
  if (redis) return redis;
  if (!USE_REDIS_CACHE) {
    fallbackEnabled = true;
    return null;
  }
  try {
    redis = new IORedis(REDIS_URL, {
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis cache unavailable after 3 retries, using in-memory fallback');
          fallbackEnabled = true;
          return null;
        }
        return Math.min(times * 1000, 3000);
      },
      lazyConnect: true,
    });
    redis.on('error', (err) => {
      logger.warn('Redis cache error', { error: err.message });
      fallbackEnabled = true;
    });
    redis.on('connect', () => {
      logger.info('Redis cache connected');
      fallbackEnabled = false;
    });
  } catch (err) {
    logger.warn('Failed to initialize Redis cache', { error: err.message });
    fallbackEnabled = true;
  }
  return redis;
}

/**
 * Build a cache key with optional prefix.
 */
export function buildKey(key, prefix = 'ama') {
  return prefix ? `${prefix}:${key}` : key;
}

/**
 * Get a value from cache.
 */
export async function get(key, prefix = 'ama') {
  const fullKey = buildKey(key, prefix);
  const client = getRedis();
  if (client && !fallbackEnabled) {
    try {
      const val = await client.get(fullKey);
      return val ? JSON.parse(val) : null;
    } catch (err) {
      logger.warn('Redis cache get failed, falling back to memory', { error: err.message });
    }
  }
  const entry = memoryCache.get(fullKey);
  if (!entry) return null;
  if (entry.expiry && Date.now() > entry.expiry) {
    memoryCache.delete(fullKey);
    return null;
  }
  return entry.value;
}

/**
 * Set a value in cache with optional TTL (seconds).
 */
export async function set(key, value, ttl = DEFAULT_TTL, prefix = 'ama') {
  const fullKey = buildKey(key, prefix);
  const client = getRedis();
  if (client && !fallbackEnabled) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl > 0) {
        await client.setex(fullKey, ttl, serialized);
      } else {
        await client.set(fullKey, serialized);
      }
      return;
    } catch (err) {
      logger.warn('Redis cache set failed, falling back to memory', { error: err.message });
    }
  }
  memoryCache.set(fullKey, {
    value,
    expiry: ttl > 0 ? Date.now() + ttl * 1000 : null,
  });
}

/**
 * Delete a value from cache.
 */
export async function del(key, prefix = 'ama') {
  const fullKey = buildKey(key, prefix);
  const client = getRedis();
  if (client && !fallbackEnabled) {
    try {
      await client.del(fullKey);
    } catch (err) {
      logger.warn('Redis cache del failed', { error: err.message });
    }
  }
  memoryCache.delete(fullKey);
}

/**
 * Delete values matching a pattern (memory fallback iterates).
 */
export async function delPattern(pattern, prefix = 'ama') {
  const fullPattern = buildKey(pattern, prefix);
  const client = getRedis();
  if (client && !fallbackEnabled) {
    try {
      const keys = await client.keys(`${fullPattern}*`);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (err) {
      logger.warn('Redis cache delPattern failed', { error: err.message });
    }
  }
  // Memory fallback: iterate and delete matching keys
  for (const [key] of memoryCache) {
    if (key.startsWith(fullPattern)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Check if a key exists in cache.
 */
export async function exists(key, prefix = 'ama') {
  const fullKey = buildKey(key, prefix);
  const client = getRedis();
  if (client && !fallbackEnabled) {
    try {
      return (await client.exists(fullKey)) === 1;
    } catch (err) {
      logger.warn('Redis cache exists failed', { error: err.message });
    }
  }
  const entry = memoryCache.get(fullKey);
  if (!entry) return false;
  if (entry.expiry && Date.now() > entry.expiry) {
    memoryCache.delete(fullKey);
    return false;
  }
  return true;
}

/**
 * Increment a numeric value in cache.
 */
export async function increment(key, amount = 1, prefix = 'ama') {
  const fullKey = buildKey(key, prefix);
  const client = getRedis();
  if (client && !fallbackEnabled) {
    try {
      return await client.incrby(fullKey, amount);
    } catch (err) {
      logger.warn('Redis cache increment failed', { error: err.message });
    }
  }
  const entry = memoryCache.get(fullKey);
  const current = entry ? parseInt(entry.value, 10) || 0 : 0;
  const next = current + amount;
  memoryCache.set(fullKey, { value: next, expiry: entry?.expiry || null });
  return next;
}

/**
 * Get or compute a value: fetch from cache, or compute and store.
 */
export async function getOrCompute(key, computeFn, ttl = DEFAULT_TTL, prefix = 'ama') {
  const cached = await get(key, prefix);
  if (cached !== null) return cached;
  const value = await computeFn();
  await set(key, value, ttl, prefix);
  return value;
}

/**
 * Flush all cache entries.
 */
export async function flush() {
  const client = getRedis();
  if (client && !fallbackEnabled) {
    try {
      await client.flushdb();
    } catch (err) {
      logger.warn('Redis cache flush failed', { error: err.message });
    }
  }
  memoryCache.clear();
  logger.info('Cache flushed');
}

/**
 * Get cache statistics.
 */
export async function getStats() {
  const client = getRedis();
  if (client && !fallbackEnabled) {
    try {
      const info = await client.info('memory');
      const used = info.match(/used_memory:(\d+)/);
      return {
        backend: 'redis',
        memoryUsed: used ? parseInt(used[1], 10) : 0,
        fallback: false,
      };
    } catch (err) {
      logger.warn('Redis cache stats failed', { error: err.message });
    }
  }
  return {
    backend: 'memory',
    keys: memoryCache.size,
    fallback: true,
  };
}

/**
 * Graceful shutdown.
 */
export async function close() {
  if (redis) {
    try {
      await redis.quit();
      logger.info('Redis cache connection closed');
    } catch (err) {
      logger.warn('Error closing Redis cache', { error: err.message });
    }
    redis = null;
  }
  memoryCache.clear();
}

export default { get, set, del, delPattern, exists, increment, getOrCompute, flush, getStats, close, buildKey };

export const cache = { get, set, del, delPattern, exists, increment, getOrCompute, flush, getStats, close, buildKey };
