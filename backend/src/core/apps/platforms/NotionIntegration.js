import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class NotionIntegration extends AppIntegration {
  constructor() { super({ id: 'notion', name: 'Notion', category: 'productivity', capabilities: ['publish', 'sync', 'notes', 'database'], authType: 'apikey', description: 'Sync content and notes to Notion workspaces', icon: 'BookOpen' }) }
  async connect(config) { if (!config.apiKey) throw new IntegrationError('Notion API key required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://api.notion.com/v1/users/me', { headers: { Authorization: `Bearer ${this._config.apiKey}`, 'Notion-Version': '2022-06-28' } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `notion-${Date.now()}`, status: 'synced' } }
  async getAnalytics() { return null }
}
export default new NotionIntegration()
