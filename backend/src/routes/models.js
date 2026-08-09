import { Router } from 'express'
import ModelRegistry from '../core/ai/ModelRegistry.js'

const router = Router()

router.get('/', (req, res) => {
  const { provider, mode } = req.query
  let models = ModelRegistry.getAll()

  if (provider) {
    models = models.filter(m => m.provider === provider)
  }
  if (mode) {
    models = models.filter(m => m.modes.includes(mode))
  }

  res.json({ models, count: models.length })
})

router.get('/providers', (req, res) => {
  const providers = [...new Set(ModelRegistry.getAll().map(m => m.provider))]
  res.json({ providers })
})

router.get('/modes', (req, res) => {
  const modes = [...new Set(ModelRegistry.getAll().flatMap(m => m.modes))]
  res.json({ modes })
})

router.get('/:id', (req, res) => {
  const model = ModelRegistry.getById(req.params.id)
  if (!model) {
    return res.status(404).json({ error: 'Model not found' })
  }
  res.json({ model })
})

router.get('/:id/cost', (req, res) => {
  const { inputTokens, outputTokens } = req.query
  const cost = ModelRegistry.estimateCost(req.params.id, parseInt(inputTokens) || 1000, parseInt(outputTokens) || 1000)
  if (!cost) {
    return res.status(404).json({ error: 'Model not found' })
  }
  res.json({ cost })
})

export default router
