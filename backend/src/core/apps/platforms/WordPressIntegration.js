import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class WordPressIntegration extends AppIntegration {
  constructor() { super({ id: 'wordpress', name: 'WordPress', category: 'content', capabilities: ['publish', 'analytics', 'schedule', 'media'], authType: 'basic', description: 'Publish blog posts and manage WordPress site', icon: 'FileText' }) }
  async connect(config) { if (!config.url || !config.username || !config.password) throw new IntegrationError('WordPress URL, username, and password required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get(`${this._config.url}/wp-json/wp/v2/users/me`, { auth: { username: this._config.username, password: this._config.password } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `wp-${Date.now()}`, url: `${this._config.url}/?p=${Date.now()}`, status: 'published' } }
  async getAnalytics() { if (!this._connected) return null; return { views: 0, visitors: 0, posts: 0 } }
}
export default new WordPressIntegration()
