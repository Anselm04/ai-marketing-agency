import IntegrationRegistry from '../core/IntegrationRegistry.js'
import ConfigManager from '../core/ConfigManager.js'
import logger from '../utils/logger.js'

// Import and register all integrations
import TwitterIntegration from '../core/apps/platforms/TwitterIntegration.js'
import LinkedInIntegration from '../core/apps/platforms/LinkedInIntegration.js'
import InstagramIntegration from '../core/apps/platforms/InstagramIntegration.js'
import FacebookIntegration from '../core/apps/platforms/FacebookIntegration.js'
import TikTokIntegration from '../core/apps/platforms/TikTokIntegration.js'
import YouTubeIntegration from '../core/apps/platforms/YouTubeIntegration.js'
import PinterestIntegration from '../core/apps/platforms/PinterestIntegration.js'
import RedditIntegration from '../core/apps/platforms/RedditIntegration.js'
import DiscordIntegration from '../core/apps/platforms/DiscordIntegration.js'
import SlackIntegration from '../core/apps/platforms/SlackIntegration.js'
import ShopifyIntegration from '../core/apps/platforms/ShopifyIntegration.js'
import WordPressIntegration from '../core/apps/platforms/WordPressIntegration.js'
import MailchimpIntegration from '../core/apps/platforms/MailchimpIntegration.js'
import HubSpotIntegration from '../core/apps/platforms/HubSpotIntegration.js'
import SalesforceIntegration from '../core/apps/platforms/SalesforceIntegration.js'
import StripeIntegration from '../core/apps/platforms/StripeIntegration.js'
import GoogleAdsIntegration from '../core/apps/platforms/GoogleAdsIntegration.js'
import MetaAdsIntegration from '../core/apps/platforms/MetaAdsIntegration.js'
import NotionIntegration from '../core/apps/platforms/NotionIntegration.js'
import AirtableIntegration from '../core/apps/platforms/AirtableIntegration.js'
import ZoomIntegration from '../core/apps/platforms/ZoomIntegration.js'
import TeamsIntegration from '../core/apps/platforms/TeamsIntegration.js'
import CalendlyIntegration from '../core/apps/platforms/CalendlyIntegration.js'
import EtsyIntegration from '../core/apps/platforms/EtsyIntegration.js'
import AmazonIntegration from '../core/apps/platforms/AmazonIntegration.js'
import SendGridIntegration from '../core/apps/platforms/SendGridIntegration.js'
import TikTokAdsIntegration from '../core/apps/platforms/TikTokAdsIntegration.js'
import CanvaIntegration from '../core/apps/platforms/CanvaIntegration.js'

// Register all integrations
IntegrationRegistry.register(TwitterIntegration)
IntegrationRegistry.register(LinkedInIntegration)
IntegrationRegistry.register(InstagramIntegration)
IntegrationRegistry.register(FacebookIntegration)
IntegrationRegistry.register(TikTokIntegration)
IntegrationRegistry.register(YouTubeIntegration)
IntegrationRegistry.register(PinterestIntegration)
IntegrationRegistry.register(RedditIntegration)
IntegrationRegistry.register(DiscordIntegration)
IntegrationRegistry.register(SlackIntegration)
IntegrationRegistry.register(ShopifyIntegration)
IntegrationRegistry.register(WordPressIntegration)
IntegrationRegistry.register(MailchimpIntegration)
IntegrationRegistry.register(HubSpotIntegration)
IntegrationRegistry.register(SalesforceIntegration)
IntegrationRegistry.register(StripeIntegration)
IntegrationRegistry.register(GoogleAdsIntegration)
IntegrationRegistry.register(MetaAdsIntegration)
IntegrationRegistry.register(NotionIntegration)
IntegrationRegistry.register(AirtableIntegration)
IntegrationRegistry.register(ZoomIntegration)
IntegrationRegistry.register(TeamsIntegration)
IntegrationRegistry.register(CalendlyIntegration)
IntegrationRegistry.register(EtsyIntegration)
IntegrationRegistry.register(AmazonIntegration)
IntegrationRegistry.register(SendGridIntegration)
IntegrationRegistry.register(TikTokAdsIntegration)
IntegrationRegistry.register(CanvaIntegration)

logger.info('IntegrationService initialized', { count: IntegrationRegistry.getCount() })

class IntegrationService {
  async listAvailable() {
    return IntegrationRegistry.getAll().map(i => ({
      ...i.getInfo(),
      connected: false, // Will be overridden by user-specific status
    }))
  }

  async listConnected(userId) {
    const configs = await ConfigManager.getAllForUser(userId)
    const connectedIds = configs.map(c => c.integrationId)
    const all = IntegrationRegistry.getAll()

    return all.map(i => {
      const config = configs.find(c => c.integrationId === i.id)
      const isConnected = !!config
      return {
        ...i.getInfo(),
        connected: isConnected,
        config: isConnected ? { ...config.config, apiKey: undefined, accessToken: undefined, password: undefined } : null,
      }
    })
  }

  async connect(userId, integrationId, config) {
    const integration = IntegrationRegistry.get(integrationId)
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`)
    }

    await integration.connect(config)
    await ConfigManager.setConfig(userId, integrationId, config)
    logger.info(`Integration connected: ${integrationId} for user ${userId}`)
    return { success: true, integrationId }
  }

  async disconnect(userId, integrationId) {
    const integration = IntegrationRegistry.get(integrationId)
    if (integration) {
      await integration.disconnect()
    }
    await ConfigManager.revokeConfig(userId, integrationId)
    logger.info(`Integration disconnected: ${integrationId} for user ${userId}`)
    return { success: true }
  }

  async testConnection(userId, integrationId) {
    const integration = IntegrationRegistry.get(integrationId)
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`)
    }

    const config = await ConfigManager.getConfig(userId, integrationId)
    if (!config) {
      return { connected: false, error: 'Not configured' }
    }

    await integration.connect(config)
    const result = await integration.testConnection()
    return { connected: result }
  }

  async getStatus(userId) {
    const all = IntegrationRegistry.getAll()
    const configs = await ConfigManager.getAllForUser(userId)
    const connectedIds = new Set(configs.map(c => c.integrationId))

    const categories = {}
    for (const integration of all) {
      const cat = integration.category
      if (!categories[cat]) categories[cat] = { total: 0, connected: 0 }
      categories[cat].total += 1
      if (connectedIds.has(integration.id)) categories[cat].connected += 1
    }

    return {
      total: all.length,
      connected: connectedIds.size,
      categories: Object.entries(categories).map(([name, stats]) => ({
        name,
        ...stats,
      })),
      integrations: all.map(i => ({
        id: i.id,
        name: i.name,
        category: i.category,
        connected: connectedIds.has(i.id),
        authType: i.authType,
      })),
    }
  }

  async publishToAll(userId, content) {
    const configs = await ConfigManager.getAllForUser(userId)
    const results = []

    for (const config of configs) {
      const integration = IntegrationRegistry.get(config.integrationId)
      if (!integration) continue

      try {
        await integration.connect(config.config)
        const result = await integration.publish(content)
        results.push({ integrationId: integration.id, name: integration.name, status: 'success', result })
      } catch (err) {
        logger.error(`Publish failed for ${integration.id}`, { error: err.message, userId })
        results.push({ integrationId: integration.id, name: integration.name, status: 'error', error: err.message })
      }
    }

    return results
  }

  async getAnalytics(userId, integrationId) {
    const integration = IntegrationRegistry.get(integrationId)
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`)
    }

    const config = await ConfigManager.getConfig(userId, integrationId)
    if (!config) {
      return null
    }

    await integration.connect(config)
    return integration.getAnalytics()
  }

  getOAuthUrl(integrationId, redirectUri) {
    // Generate OAuth 2.0 authorization URL for supported integrations
    const oauthUrls = {
      twitter: 'https://twitter.com/i/oauth2/authorize',
      linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
      instagram: 'https://api.instagram.com/oauth/authorize',
      facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
      youtube: 'https://accounts.google.com/o/oauth2/v2/auth',
      google: 'https://accounts.google.com/o/oauth2/v2/auth',
      'google-ads': 'https://accounts.google.com/o/oauth2/v2/auth',
      'meta-ads': 'https://www.facebook.com/v18.0/dialog/oauth',
      shopify: 'https://accounts.shopify.com/oauth/authorize',
      zoom: 'https://zoom.us/oauth/authorize',
      salesforce: 'https://login.salesforce.com/services/oauth2/authorize',
      tiktok: 'https://www.tiktok.com/auth/authorize',
      etsy: 'https://www.etsy.com/oauth/connect',
    }

    return oauthUrls[integrationId] || null
  }
}

export default new IntegrationService()
