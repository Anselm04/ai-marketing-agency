import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class DiscordIntegration extends AppIntegration {
  constructor() { super({ id: 'discord', name: 'Discord', category: 'social', capabilities: ['publish', 'engagement', 'community'], authType: 'webhook', description: 'Post to Discord channels via webhooks', icon: 'MessageSquare' }) }
  async connect(config) { if (!config.webhookUrl) throw new IntegrationError('Discord webhook URL required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get(this._config.webhookUrl); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); await axios.post(this._config.webhookUrl, { content: content.text || content }); return { id: `discord-${Date.now()}`, status: 'published' } }
  async getAnalytics() { return null }
}
export default new DiscordIntegration()
