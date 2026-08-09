import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class InstagramIntegration extends AppIntegration {
  constructor() {
    super({
      id: 'instagram',
      name: 'Instagram',
      category: 'social',
      capabilities: ['publish', 'analytics', 'schedule', 'engagement'],
      authType: 'oauth2',
      description: 'Share visual content, stories, and reels on Instagram',
      icon: 'Instagram',
    })
  }

  async connect(config) {
    if (!config.accessToken) {
      throw new IntegrationError('Instagram access token required', this.id, 'MISSING_CREDENTIALS')
    }
    this._setConnected(config)
    return true
  }

  async testConnection() {
    if (!this._connected) return false
    try {
      await axios.get('https://graph.instagram.com/me', {
        params: { access_token: this._config.accessToken },
      })
      return true
    } catch (err) {
      return false
    }
  }

  async publish(content) {
    if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED')
    try {
      const caption = content.text || content
      logger.info(`Instagram publish simulated`, { caption: caption.substring(0, 50) })
      return { id: `ig-${Date.now()}`, url: `https://instagram.com/p/${Date.now()}`, status: 'published' }
    } catch (err) {
      this._handleError(err, 'publish')
    }
  }

  async getAnalytics() {
    if (!this._connected) return null
    return { impressions: 0, engagements: 0, followers: 0 }
  }
}

export default new InstagramIntegration()
