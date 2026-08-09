import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class SlackIntegration extends AppIntegration {
  constructor() { super({ id: 'slack', name: 'Slack', category: 'productivity', capabilities: ['publish', 'notifications', 'engagement'], authType: 'webhook', description: 'Send notifications and updates to Slack channels', icon: 'MessageSquare' }) }
  async connect(config) { if (!config.webhookUrl) throw new IntegrationError('Slack webhook URL required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.post(this._config.webhookUrl, { text: 'Test connection from AI Marketing Agency' }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); await axios.post(this._config.webhookUrl, { text: content.text || content }); return { id: `slack-${Date.now()}`, status: 'published' } }
  async getAnalytics() { return null }
}
export default new SlackIntegration()
