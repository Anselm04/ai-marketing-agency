import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class LinkedInIntegration extends AppIntegration {
  constructor() {
    super({
      id: 'linkedin',
      name: 'LinkedIn',
      category: 'social',
      capabilities: ['publish', 'analytics', 'schedule', 'engagement'],
      authType: 'oauth2',
      description: 'Share professional content and build B2B presence on LinkedIn',
      icon: 'Linkedin',
    })
  }

  async connect(config) {
    if (!config.accessToken) {
      throw new IntegrationError('LinkedIn access token required', this.id, 'MISSING_CREDENTIALS')
    }
    this._setConnected(config)
    return true
  }

  async testConnection() {
    if (!this._connected) return false
    try {
      await axios.get('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${this._config.accessToken}` },
      })
      return true
    } catch (err) {
      return false
    }
  }

  async publish(content) {
    if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED')
    try {
      const post = content.text || content
      logger.info(`LinkedIn publish simulated`, { post: post.substring(0, 50) })
      return { id: `linkedin-${Date.now()}`, url: `https://linkedin.com/feed/update/${Date.now()}`, status: 'published' }
    } catch (err) {
      this._handleError(err, 'publish')
    }
  }

  async getAnalytics() {
    if (!this._connected) return null
    return { impressions: 0, engagements: 0, followers: 0 }
  }
}

export default new LinkedInIntegration()
