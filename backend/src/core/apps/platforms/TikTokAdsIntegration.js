import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class TikTokAdsIntegration extends AppIntegration {
  constructor() { super({ id: 'tiktok-ads', name: 'TikTok Ads', category: 'ads', capabilities: ['publish', 'analytics', 'schedule', 'targeting'], authType: 'oauth2', description: 'Create and manage TikTok advertising campaigns', icon: 'Video' }) }
  async connect(config) { if (!config.accessToken) throw new IntegrationError('TikTok Ads access token required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://business-api.tiktok.com/open_api/v1.3/user/info/', { headers: { 'Access-Token': this._config.accessToken } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `tt-ads-${Date.now()}`, status: 'published' } }
  async getAnalytics() { if (!this._connected) return null; return { impressions: 0, clicks: 0, conversions: 0, cost: 0 } }
}
export default new TikTokAdsIntegration()
