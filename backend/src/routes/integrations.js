import { Router } from 'express'
import integrationService from '../services/integrationService.js'
import logger from '../utils/logger.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const available = await integrationService.listAvailable()
    const connected = await integrationService.listConnected(req.userId)
    res.json({
      available,
      connected: connected.filter(c => c.connected),
      all: connected,
    })
  } catch (err) {
    logger.error('Failed to list integrations', { error: err.message, userId: req.userId })
    res.status(500).json({ error: err.message })
  }
})

router.get('/status', async (req, res) => {
  try {
    const status = await integrationService.getStatus(req.userId)
    res.json(status)
  } catch (err) {
    logger.error('Failed to get integration status', { error: err.message, userId: req.userId })
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/connect', async (req, res) => {
  try {
    const result = await integrationService.connect(req.userId, req.params.id, req.body)
    res.json(result)
  } catch (err) {
    logger.error('Failed to connect integration', { error: err.message, integrationId: req.params.id, userId: req.userId })
    res.status(400).json({ error: err.message })
  }
})

router.post('/:id/disconnect', async (req, res) => {
  try {
    const result = await integrationService.disconnect(req.userId, req.params.id)
    res.json(result)
  } catch (err) {
    logger.error('Failed to disconnect integration', { error: err.message, integrationId: req.params.id, userId: req.userId })
    res.status(400).json({ error: err.message })
  }
})

router.post('/:id/test', async (req, res) => {
  try {
    const result = await integrationService.testConnection(req.userId, req.params.id)
    res.json(result)
  } catch (err) {
    logger.error('Failed to test integration', { error: err.message, integrationId: req.params.id, userId: req.userId })
    res.status(400).json({ error: err.message })
  }
})

router.get('/:id/auth', async (req, res) => {
  try {
    const url = integrationService.getOAuthUrl(req.params.id, req.query.redirect_uri)
    if (!url) {
      return res.status(400).json({ error: 'OAuth not supported for this integration' })
    }
    res.json({ url })
  } catch (err) {
    logger.error('Failed to generate OAuth URL', { error: err.message, integrationId: req.params.id })
    res.status(400).json({ error: err.message })
  }
})

router.get('/:id/callback', async (req, res) => {
  try {
    // In a real implementation, exchange the authorization code for an access token
    const { code, state } = req.query
    res.json({ success: true, code, state })
  } catch (err) {
    logger.error('OAuth callback failed', { error: err.message, integrationId: req.params.id })
    res.status(400).json({ error: err.message })
  }
})

router.get('/:id/analytics', async (req, res) => {
  try {
    const analytics = await integrationService.getAnalytics(req.userId, req.params.id)
    res.json({ analytics })
  } catch (err) {
    logger.error('Failed to get analytics', { error: err.message, integrationId: req.params.id, userId: req.userId })
    res.status(400).json({ error: err.message })
  }
})

router.post('/publish-all', async (req, res) => {
  try {
    const results = await integrationService.publishToAll(req.userId, req.body)
    res.json({ results })
  } catch (err) {
    logger.error('Failed to publish to all', { error: err.message, userId: req.userId })
    res.status(500).json({ error: err.message })
  }
})

export default router
