import logger from '../utils/logger.js'

class IntegrationRegistry {
  constructor() {
    this.integrations = new Map()
  }

  register(integration) {
    if (!integration.id) {
      throw new Error('Integration must have an id')
    }
    this.integrations.set(integration.id, integration)
    logger.info(`Integration registered: ${integration.id}`, {
      name: integration.name,
      category: integration.category,
      authType: integration.authType,
    })
  }

  get(id) {
    return this.integrations.get(id)
  }

  getByCategory(category) {
    return Array.from(this.integrations.values()).filter(i => i.category === category)
  }

  getByCapability(capability) {
    return Array.from(this.integrations.values()).filter(i => i.capabilities.includes(capability))
  }

  getAll() {
    return Array.from(this.integrations.values())
  }

  getCategories() {
    const categories = new Set()
    this.integrations.forEach(i => categories.add(i.category))
    return Array.from(categories)
  }

  getAllInfo() {
    return this.getAll().map(i => i.getInfo())
  }

  async getConnected(userId, configManager) {
    const configs = await configManager.getAllForUser(userId)
    const connected = []
    for (const config of configs) {
      const integration = this.get(config.integrationId)
      if (integration) {
        integration._connected = true
        integration._config = config.config
        connected.push(integration)
      }
    }
    return connected
  }

  getCount() {
    return this.integrations.size
  }
}

export default new IntegrationRegistry()
