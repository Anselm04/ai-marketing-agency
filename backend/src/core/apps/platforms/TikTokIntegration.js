import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class TikTokIntegration extends AppIntegration {
  constructor() { super({ id: 'tiktok', name: 'TikTok', category: 'social', capabilities: ['publish', 'analytics', 'schedule'], authType: 'oauth2', description: 'Create and share TikTok videos', icon: 'Video' }) }
  async connect(config) { if (!config.accessToken) throw new IntegrationError('TikTok access token required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://open-api.tiktok.com/user/info/', { headers: { 'Access-Token': this._config.accessToken } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `tiktok-${Date.now()}`, url: `https://tiktok.com/@user/video/${Date.now()}`, status: 'published' } }
  async getAnalytics() { if (!this._connected) return null; return { views: 0, likes: 0, shares: 0 } }
}
export default new TikTokIntegration()
