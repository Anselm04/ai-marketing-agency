import { getRedis } from '../config/redis.js'
import logger from '../utils/logger.js'

class Cache {
  constructor() {
    this.memoryCache = new Map()
    this.ttlSeconds = 3600
  }

  _getRedis() {
    return getRedis()
  }

  async get(key) {
    const redis = this._getRedis()
    if (redis) {
      try {
        const val = await redis.get(key)
        if (val) return JSON.parse(val)
      } catch (err) {
        logger.warn('Redis cache get failed, falling back to memory', { key, error: err.message })
      }
    }
    const entry = this.memoryCache.get(key)
    if (entry && entry.expires > Date.now()) {
      return entry.value
    }
    this.memoryCache.delete(key)
    return null
  }

  async set(key, value, ttl = this.ttlSeconds) {
    const redis = this._getRedis()
    if (redis) {
      try {
        await redis.setex(key, ttl, JSON.stringify(value))
        return
      } catch (err) {
        logger.warn('Redis cache set failed, falling back to memory', { key, error: err.message })
      }
    }
    this.memoryCache.set(key, { value, expires: Date.now() + ttl * 1000 })
  }

  async del(key) {
    const redis = this._getRedis()
    if (redis) {
      try {
        await redis.del(key)
      } catch (err) {
        logger.warn('Redis cache del failed', { key, error: err.message })
      }
    }
    this.memoryCache.delete(key)
  }

  async flush() {
    const redis = this._getRedis()
    if (redis) {
      try {
        await redis.flushdb()
      } catch (err) {
        logger.warn('Redis flush failed', { error: err.message })
      }
    }
    this.memoryCache.clear()
  }

  async getOrSet(key, factory, ttl = this.ttlSeconds) {
    let val = await this.get(key)
    if (val !== null) return val
    val = await factory()
    await this.set(key, val, ttl)
    return val
  }
}

export default new Cache()
