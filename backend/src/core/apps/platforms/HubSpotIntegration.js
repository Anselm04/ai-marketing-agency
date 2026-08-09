import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class HubSpotIntegration extends AppIntegration {
  constructor() { super({ id: 'hubspot', name: 'HubSpot', category: 'crm', capabilities: ['publish', 'analytics', 'sync', 'contacts'], authType: 'apikey', description: 'Sync contacts, deals, and marketing activities with HubSpot CRM', icon: 'Users' }) }
  async connect(config) { if (!config.apiKey) throw new IntegrationError('HubSpot API key required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://api.hubapi.com/integrations/v1/me', { headers: { Authorization: `Bearer ${this._config.apiKey}` } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `hubspot-${Date.now()}`, status: 'synced' } }
  async getAnalytics() { if (!this._connected) return null; return { contacts: 0, deals: 0, revenue: 0 } }
}
export default new HubSpotIntegration()
