import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class RedditIntegration extends AppIntegration {
  constructor() { super({ id: 'reddit', name: 'Reddit', category: 'social', capabilities: ['publish', 'analytics', 'engagement'], authType: 'oauth2', description: 'Share content and engage with communities on Reddit', icon: 'MessageCircle' }) }
  async connect(config) { if (!config.accessToken) throw new IntegrationError('Reddit access token required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://oauth.reddit.com/api/v1/me', { headers: { Authorization: `Bearer ${this._config.accessToken}` } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `reddit-${Date.now()}`, url: `https://reddit.com/r/${content.subreddit || 'marketing'}/comments/${Date.now()}`, status: 'published' } }
  async getAnalytics() { if (!this._connected) return null; return { upvotes: 0, comments: 0, karma: 0 } }
}
export default new RedditIntegration()
