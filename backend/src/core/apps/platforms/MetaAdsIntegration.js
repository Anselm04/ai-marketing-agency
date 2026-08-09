import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class MetaAdsIntegration extends AppIntegration {
  constructor() { super({ id: 'meta-ads', name: 'Meta Ads', category: 'ads', capabilities: ['publish', 'analytics', 'schedule', 'targeting'], authType: 'oauth2', description: 'Create and manage Facebook and Instagram ad campaigns', icon: 'Target' }) }
  async connect(config) { if (!config.accessToken) throw new IntegrationError('Meta access token required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://graph.facebook.com/v18.0/me/adaccounts', { params: { access_token: this._config.accessToken } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `meta-ads-${Date.now()}`, status: 'published' } }
  async getAnalytics() { if (!this._connected) return null; return { impressions: 0, clicks: 0, conversions: 0, cost: 0 } }
}
export default new MetaAdsIntegration()
