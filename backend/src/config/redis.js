import Redis from 'ioredis'
import logger from '../utils/logger.js'

let client = null
let isReady = false

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  const password = process.env.REDIS_PASSWORD || undefined

  const instance = new Redis(redisUrl, {
    password,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    reconnectOnError: (err) => {
      logger.warn('Redis reconnectOnError triggered', { error: err.message })
      return true
    },
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000)
      logger.warn(`Redis retry attempt ${times}, delay ${delay}ms`)
      return delay
    },
    lazyConnect: true,
  })

  instance.on('connect', () => {
    logger.info('Redis connected')
    isReady = true
  })

  instance.on('ready', () => {
    logger.info('Redis ready')
    isReady = true
  })

  instance.on('error', (err) => {
    logger.error('Redis error', { error: err.message })
    isReady = false
  })

  instance.on('close', () => {
    logger.warn('Redis connection closed')
    isReady = false
  })

  instance.on('reconnecting', () => {
    logger.info('Redis reconnecting...')
  })

  return instance
}

export async function connectRedis() {
  if (client) return client

  client = createRedisClient()
  try {
    await client.connect()
    return client
  } catch (err) {
    logger.error('Failed to connect to Redis, proceeding without cache', { error: err.message })
    client = null
    return null
  }
}

export function getRedis() {
  return client
}

export function redisStatus() {
  return { connected: isReady, client: client ? 'initialized' : 'not initialized' }
}

export async function disconnectRedis() {
  if (client) {
    await client.quit()
    client = null
    isReady = false
    logger.info('Redis disconnected gracefully')
  }
}
