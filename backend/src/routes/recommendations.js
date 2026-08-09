import { Router } from 'express'
import AutoRecommender from '../core/AutoRecommender.js'
import store from '../utils/store.js'
import logger from '../utils/logger.js'

const router = Router()

router.post('/campaign', async (req, res) => {
  try {
    const user = await store.findUserById(req.userId)
    const recommendations = await AutoRecommender.recommendCampaign(req.userId, {
      ...req.body,
      userTier: user?.role || 'standard',
    })
    res.json(recommendations)
  } catch (err) {
    logger.error('Campaign recommendation failed', { error: err.message, userId: req.userId })
    res.status(500).json({ error: err.message })
  }
})

router.get('/next', async (req, res) => {
  try {
    const user = await store.findUserById(req.userId)
    const org = await store.getOrganizationByUserId(req.userId)
    const campaigns = await store.getCampaigns()
    const userCampaigns = campaigns.filter(c => c.ownerId === req.userId)
    const integrations = await store.getSettings().then(s => s.integrations?.[req.userId] || {})

    const connectedCount = Object.keys(integrations).length

    const recommendations = await AutoRecommender.recommendNextAction(req.userId, {
      connectedIntegrations: connectedCount,
      totalIntegrations: 25,
      campaignsCreated: userCampaigns.length,
      hasPaymentMethod: user?.subscription?.status === 'active',
      teamMembers: org?.members?.length || 1,
    })

    res.json({ recommendations })
  } catch (err) {
    logger.error('Next action recommendation failed', { error: err.message, userId: req.userId })
    res.status(500).json({ error: err.message })
  }
})

router.post('/models', async (req, res) => {
  try {
    const { task, requirements } = req.body
    const recommendations = await AutoRecommender.recommendModels(task, requirements)
    res.json({ recommendations })
  } catch (err) {
    logger.error('Model recommendation failed', { error: err.message, userId: req.userId })
    res.status(500).json({ error: err.message })
  }
})

router.post('/feedback', async (req, res) => {
  try {
    // Store feedback for improving future recommendations
    const { recommendationId, accepted, feedback } = req.body
    logger.info('Recommendation feedback received', { recommendationId, accepted, userId: req.userId })
    res.json({ success: true })
  } catch (err) {
    logger.error('Feedback storage failed', { error: err.message, userId: req.userId })
    res.status(500).json({ error: err.message })
  }
})

export default router
