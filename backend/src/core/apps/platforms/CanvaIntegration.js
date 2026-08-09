import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class CanvaIntegration extends AppIntegration {
  constructor() { super({ id: 'canva', name: 'Canva', category: 'content', capabilities: ['publish', 'design', 'sync'], authType: 'oauth2', description: 'Design graphics and sync templates with Canva', icon: 'Image' }) }
  async connect(config) { if (!config.accessToken) throw new IntegrationError('Canva access token required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://api.canva.com/rest/v1/users/me', { headers: { Authorization: `Bearer ${this._config.accessToken}` } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `canva-${Date.now()}`, status: 'synced' } }
  async getAnalytics() { return null }
}
export default new CanvaIntegration()
