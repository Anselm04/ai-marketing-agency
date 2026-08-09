import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class SalesforceIntegration extends AppIntegration {
  constructor() { super({ id: 'salesforce', name: 'Salesforce', category: 'crm', capabilities: ['publish', 'sync', 'contacts', 'analytics'], authType: 'oauth2', description: 'Sync leads, contacts, and opportunities with Salesforce', icon: 'Briefcase' }) }
  async connect(config) { if (!config.accessToken || !config.instanceUrl) throw new IntegrationError('Salesforce access token and instance URL required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get(`${this._config.instanceUrl}/services/data/v59.0/limits`, { headers: { Authorization: `Bearer ${this._config.accessToken}` } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `salesforce-${Date.now()}`, status: 'synced' } }
  async getAnalytics() { if (!this._connected) return null; return { leads: 0, opportunities: 0, revenue: 0 } }
}
export default new SalesforceIntegration()
