import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class ShopifyIntegration extends AppIntegration {
  constructor() {
    super({
      id: 'shopify',
      name: 'Shopify',
      category: 'ecommerce',
      capabilities: ['publish', 'analytics', 'sync', 'inventory'],
      authType: 'oauth2',
      description: 'Sync products, manage inventory, and track sales in Shopify',
      icon: 'ShoppingCart',
    })
  }

  async connect(config) {
    if (!config.shopDomain || !config.accessToken) {
      throw new IntegrationError('Shopify shop domain and access token required', this.id, 'MISSING_CREDENTIALS')
    }
    this._setConnected(config)
    return true
  }

  async testConnection() {
    if (!this._connected) return false
    try {
      await axios.get(`https://${this._config.shopDomain}/admin/api/2024-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': this._config.accessToken },
      })
      return true
    } catch (err) {
      return false
    }
  }

  async publish(content) {
    if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED')
    try {
      logger.info(`Shopify product sync simulated`, { product: content.productName })
      return { id: `shopify-${Date.now()}`, status: 'synced' }
    } catch (err) {
      this._handleError(err, 'publish')
    }
  }

  async getAnalytics() {
    if (!this._connected) return null
    return { orders: 0, revenue: 0, visitors: 0 }
  }
}

export default new ShopifyIntegration()
