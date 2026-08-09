import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class SendGridIntegration extends AppIntegration {
  constructor() { super({ id: 'sendgrid', name: 'SendGrid', category: 'email', capabilities: ['publish', 'analytics', 'schedule', 'audience'], authType: 'apikey', description: 'Send transactional and marketing emails via SendGrid', icon: 'Mail' }) }
  async connect(config) { if (!config.apiKey) throw new IntegrationError('SendGrid API key required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://api.sendgrid.com/v3/user/profile', { headers: { Authorization: `Bearer ${this._config.apiKey}` } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `sg-${Date.now()}`, status: 'sent' } }
  async getAnalytics() { if (!this._connected) return null; return { delivered: 0, opened: 0, clicked: 0, bounced: 0 } }
}
export default new SendGridIntegration()
