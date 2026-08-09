import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class CalendlyIntegration extends AppIntegration {
  constructor() { super({ id: 'calendly', name: 'Calendly', category: 'productivity', capabilities: ['schedule', 'sync', 'analytics'], authType: 'apikey', description: 'Schedule meetings and sync appointment data', icon: 'Calendar' }) }
  async connect(config) { if (!config.apiKey) throw new IntegrationError('Calendly API key required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://api.calendly.com/users/me', { headers: { Authorization: `Bearer ${this._config.apiKey}` } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `calendly-${Date.now()}`, status: 'synced' } }
  async getAnalytics() { if (!this._connected) return null; return { scheduled: 0, completed: 0, canceled: 0 } }
}
export default new CalendlyIntegration()
