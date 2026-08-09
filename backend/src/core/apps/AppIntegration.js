import logger from '../../utils/logger.js'

export class IntegrationError extends Error {
  constructor(message, integrationId, code) {
    super(message)
    this.integrationId = integrationId
    this.code = code
    this.name = 'IntegrationError'
  }
}

export class AppIntegration {
  constructor(config) {
    this.id = config.id
    this.name = config.name
    this.category = config.category
    this.capabilities = config.capabilities || []
    this.authType = config.authType || 'apikey' // 'oauth2', 'apikey', 'basic', 'webhook'
    this.configSchema = config.configSchema || {}
    this.oauthConfig = config.oauthConfig || null
    this.description = config.description || ''
    this.icon = config.icon || 'Globe'
    this.documentationUrl = config.documentationUrl || ''
    this._connected = false
    this._config = null
  }

  getInfo() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      capabilities: this.capabilities,
      authType: this.authType,
      description: this.description,
      icon: this.icon,
      documentationUrl: this.documentationUrl,
      connected: this._connected,
    }
  }

  async connect(config) {
    throw new IntegrationError(`connect() not implemented for ${this.id}`, this.id, 'NOT_IMPLEMENTED')
  }

  async disconnect() {
    this._connected = false
    this._config = null
    return true
  }

  isConnected() {
    return this._connected
  }

  async testConnection() {
    throw new IntegrationError(`testConnection() not implemented for ${this.id}`, this.id, 'NOT_IMPLEMENTED')
  }

  async publish(content) {
    throw new IntegrationError(`publish() not implemented for ${this.id}`, this.id, 'NOT_IMPLEMENTED')
  }

  async getAnalytics() {
    throw new IntegrationError(`getAnalytics() not implemented for ${this.id}`, this.id, 'NOT_IMPLEMENTED')
  }

  async getStatus() {
    return {
      id: this.id,
      connected: this._connected,
      name: this.name,
      category: this.category,
    }
  }

  _handleError(err, operation) {
    logger.error(`Integration ${this.id} ${operation} failed`, { error: err.message, integration: this.id })
    throw new IntegrationError(err.message, this.id, err.code || 'UNKNOWN')
  }

  _setConnected(config) {
    this._connected = true
    this._config = config
  }
}

export default AppIntegration
