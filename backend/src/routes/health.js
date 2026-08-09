import { Router } from 'express'
import { redisStatus } from '../config/redis.js'
import { mongoStatus } from '../config/mongodb.js'
import IntegrationRegistry from '../core/IntegrationRegistry.js'
import ModelRegistry from '../core/ai/ModelRegistry.js'

const router = Router()

router.get('/', (req, res) => {
  const redis = redisStatus()
  const mongo = mongoStatus()

  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      redis: redis.connected ? 'healthy' : redis.client === 'initialized' ? 'connecting' : 'unavailable',
      mongodb: mongo.connected ? 'healthy' : 'unavailable',
    },
    integrations: {
      total: IntegrationRegistry.getCount(),
      categories: IntegrationRegistry.getCategories(),
    },
    ai: {
      models: ModelRegistry.getAll().length,
      providers: [...new Set(ModelRegistry.getAll().map(m => m.provider))].length,
    },
  }

  res.json(status)
})

export default router
