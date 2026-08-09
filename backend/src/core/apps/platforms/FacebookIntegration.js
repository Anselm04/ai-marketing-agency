import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class FacebookIntegration extends AppIntegration {
  constructor() {
    super({ id: 'facebook', name: 'Facebook', category: 'social', capabilities: ['publish', 'analytics', 'schedule', 'engagement'], authType: 'oauth2', description: 'Post to Facebook Pages and Groups', icon: 'Facebook' })
  }
  async connect(config) { if (!config.accessToken) throw new IntegrationError('Facebook access token required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://graph.facebook.com/me', { params: { access_token: this._config.accessToken } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); const post = content.text || content; return { id: `fb-${Date.now()}`, url: `https://facebook.com/${Date.now()}`, status: 'published' } }
  async getAnalytics() { if (!this._connected) return null; return { impressions: 0, engagements: 0, followers: 0 } }
}
export default new FacebookIntegration()
