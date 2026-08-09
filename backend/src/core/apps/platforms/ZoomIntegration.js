import axios from 'axios'
import { AppIntegration, IntegrationError } from '../AppIntegration.js'

class ZoomIntegration extends AppIntegration {
  constructor() { super({ id: 'zoom', name: 'Zoom', category: 'productivity', capabilities: ['publish', 'schedule', 'webinars', 'meetings'], authType: 'oauth2', description: 'Schedule webinars and meetings for marketing events', icon: 'Video' }) }
  async connect(config) { if (!config.accessToken) throw new IntegrationError('Zoom access token required', this.id, 'MISSING_CREDENTIALS'); this._setConnected(config); return true }
  async testConnection() { if (!this._connected) return false; try { await axios.get('https://api.zoom.us/v2/users/me', { headers: { Authorization: `Bearer ${this._config.accessToken}` } }); return true } catch { return false } }
  async publish(content) { if (!this._connected) throw new IntegrationError('Not connected', this.id, 'NOT_CONNECTED'); return { id: `zoom-${Date.now()}`, status: 'scheduled' } }
  async getAnalytics() { if (!this._connected) return null; return { attendees: 0, registrations: 0, recordings: 0 } }
}
export default new ZoomIntegration()
