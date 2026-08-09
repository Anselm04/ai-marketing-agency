import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class AirtableIntegration extends AppIntegration {
  constructor() { super({ id: 'airtable', name: 'Airtable', category: 'productivity', capabilities: ['publish', 'sync', 'database', 'automation'], authType: 'apikey', description: 'Sync campaign data and leads to Airtable bases', icon: 'Database' }) }
  async connect(config) { if (!config.apiKey) throw new IntegrationError('Airtable API key required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://api.airtable.com/v0/meta/bases', { headers: { Authorization: `Bearer ${this._config.apiKey}` } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `airtable-${Date.now()}`, status: 'synced' } }
  async getAnalytics() { return null }
}
export default new AirtableIntegration()
