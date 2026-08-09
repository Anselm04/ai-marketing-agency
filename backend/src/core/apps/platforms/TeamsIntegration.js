import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class TeamsIntegration extends AppIntegration {
  constructor() { super({ id: 'teams', name: 'Microsoft Teams', category: 'productivity', capabilities: ['publish', 'notifications', 'engagement'], authType: 'webhook', description: 'Send notifications and updates to Microsoft Teams channels', icon: 'MessageSquare' }) }
  async connect(config) { if (!config.webhookUrl) throw new IntegrationError('Teams webhook URL required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.post(this._config.webhookUrl, { text: 'Test connection from AI Marketing Agency' }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); await axios.post(this._config.webhookUrl, { text: content.text || content }); return { id: `teams-${Date.now()}`, status: 'published' } }
  async getAnalytics() { return null }
}
export default new TeamsIntegration()
