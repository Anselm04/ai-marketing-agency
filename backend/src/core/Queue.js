import { getRedis } from '../config/redis.js'
import logger from '../utils/logger.js'

class Queue {
  constructor() {
    this.queues = new Map()
    this.workers = new Map()
  }

  _getRedis() {
    return getRedis()
  }

  async add(queueName, job) {
    const redis = this._getRedis()
    const payload = JSON.stringify({
      ...job,
      _id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      _createdAt: new Date().toISOString(),
    })

    if (redis) {
      try {
        await redis.lpush(`queue:${queueName}`, payload)
        return
      } catch (err) {
        logger.warn('Redis queue push failed, falling back to in-memory', { queueName, error: err.message })
      }
    }

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, [])
    }
    this.queues.get(queueName).push(JSON.parse(payload))
  }

  async process(queueName, handler, concurrency = 1) {
    if (this.workers.has(queueName)) {
      logger.warn(`Worker already registered for queue ${queueName}`)
      return
    }

    this.workers.set(queueName, true)

    const run = async () => {
      while (this.workers.has(queueName)) {
        try {
          const job = await this._dequeue(queueName)
          if (job) {
            await handler(job)
          } else {
            await new Promise(r => setTimeout(r, 1000))
          }
        } catch (err) {
          logger.error(`Queue worker error in ${queueName}`, { error: err.message })
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    }

    for (let i = 0; i < concurrency; i++) {
      run()
    }
  }

  async _dequeue(queueName) {
    const redis = this._getRedis()
    if (redis) {
      try {
        const payload = await redis.brpop(`queue:${queueName}`, 1)
        if (payload && payload[1]) {
          return JSON.parse(payload[1])
        }
      } catch (err) {
        logger.warn('Redis queue dequeue failed, falling back to in-memory', { queueName, error: err.message })
      }
    }

    const queue = this.queues.get(queueName) || []
    if (queue.length > 0) {
      return queue.shift()
    }
    return null
  }

  stop(queueName) {
    this.workers.delete(queueName)
  }

  stopAll() {
    this.workers.clear()
  }

  async getLength(queueName) {
    const redis = this._getRedis()
    if (redis) {
      try {
        return await redis.llen(`queue:${queueName}`)
      } catch (err) {
        logger.warn('Redis queue length failed', { queueName, error: err.message })
      }
    }
    return (this.queues.get(queueName) || []).length
  }
}

export default new Queue()
