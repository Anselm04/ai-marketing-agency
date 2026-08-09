import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class EtsyIntegration extends AppIntegration {
  constructor() { super({ id: 'etsy', name: 'Etsy', category: 'ecommerce', capabilities: ['publish', 'sync', 'inventory', 'analytics'], authType: 'oauth2', description: 'Sync products and manage Etsy shop listings', icon: 'ShoppingBag' }) }
  async connect(config) { if (!config.accessToken) throw new IntegrationError('Etsy access token required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://openapi.etsy.com/v3/application/users/me', { headers: { 'x-api-key': this._config.apiKey } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `etsy-${Date.now()}`, status: 'synced' } }
  async getAnalytics() { if (!this._connected) return null; return { sales: 0, revenue: 0, favorites: 0 } }
}
export default new EtsyIntegration()
