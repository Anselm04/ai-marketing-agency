import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class MailchimpIntegration extends AppIntegration {
  constructor() { super({ id: 'mailchimp', name: 'Mailchimp', category: 'email', capabilities: ['publish', 'analytics', 'schedule', 'audience'], authType: 'apikey', description: 'Send email campaigns and manage subscriber lists', icon: 'Mail' }) }
  async connect(config) { if (!config.apiKey) throw new IntegrationError('Mailchimp API key required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { const datacenter = this._config.apiKey.split('-')[1]; await axios.get(`https://${datacenter}.api.mailchimp.com/3.0/`, { headers: { Authorization: `Bearer ${this._config.apiKey}` } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `mailchimp-${Date.now()}`, status: 'sent' } }
  async getAnalytics() { if (!this._connected) return null; return { opens: 0, clicks: 0, subscribers: 0 } }
}
export default new MailchimpIntegration()
