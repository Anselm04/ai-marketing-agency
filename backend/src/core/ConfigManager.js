import crypto from 'crypto'
import store from '../utils/store.js'
import logger from '../utils/logger.js'

const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-32-chars-long-12345678'
const ALGORITHM = 'aes-256-gcm'

function getKey() {
  return crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
}

function encrypt(text) {
  if (!text) return text
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

function decrypt(text) {
  if (!text) return text
  try {
    const [ivHex, authTagHex, encrypted] = text.split(':')
    if (!ivHex || !authTagHex || !encrypted) return text
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    logger.error('Config decryption failed', { error: err.message })
    return null
  }
}

function encryptConfig(config) {
  if (!config) return config
  const encrypted = { ...config }
  if (encrypted.apiKey) encrypted.apiKey = encrypt(encrypted.apiKey)
  if (encrypted.clientSecret) encrypted.clientSecret = encrypt(encrypted.clientSecret)
  if (encrypted.accessToken) encrypted.accessToken = encrypt(encrypted.accessToken)
  if (encrypted.refreshToken) encrypted.refreshToken = encrypt(encrypted.refreshToken)
  if (encrypted.password) encrypted.password = encrypt(encrypted.password)
  return encrypted
}

function decryptConfig(config) {
  if (!config) return config
  const decrypted = { ...config }
  if (decrypted.apiKey) decrypted.apiKey = decrypt(decrypted.apiKey)
  if (decrypted.clientSecret) decrypted.clientSecret = decrypt(decrypted.clientSecret)
  if (decrypted.accessToken) decrypted.accessToken = decrypt(decrypted.accessToken)
  if (decrypted.refreshToken) decrypted.refreshToken = decrypt(decrypted.refreshToken)
  if (decrypted.password) decrypted.password = decrypt(decrypted.password)
  return decrypted
}

class ConfigManager {
  async getConfig(userId, integrationId) {
    if (store.isMongo()) {
      const db = await store.getMongoDb()
      const doc = await db.collection('integrations').findOne({ userId, integrationId })
      if (!doc) return null
      return { ...doc, config: decryptConfig(doc.config) }
    }
    // JSON fallback - store in user profile or global settings
    const settings = await store.getSettings()
    const userConfigs = settings.integrations?.[userId] || {}
    return userConfigs[integrationId] ? decryptConfig(userConfigs[integrationId]) : null
  }

  async setConfig(userId, integrationId, config) {
    const encrypted = encryptConfig(config)
    if (store.isMongo()) {
      const db = await store.getMongoDb()
      await db.collection('integrations').updateOne(
        { userId, integrationId },
        { $set: { userId, integrationId, config: encrypted, updatedAt: new Date().toISOString() } },
        { upsert: true }
      )
      return true
    }
    const settings = await store.getSettings()
    if (!settings.integrations) settings.integrations = {}
    if (!settings.integrations[userId]) settings.integrations[userId] = {}
    settings.integrations[userId][integrationId] = encrypted
    await store.setSettings('integrations', settings.integrations)
    return true
  }

  async revokeConfig(userId, integrationId) {
    if (store.isMongo()) {
      const db = await store.getMongoDb()
      await db.collection('integrations').deleteOne({ userId, integrationId })
      return true
    }
    const settings = await store.getSettings()
    if (settings.integrations?.[userId]) {
      delete settings.integrations[userId][integrationId]
      await store.setSettings('integrations', settings.integrations)
    }
    return true
  }

  async getAllForUser(userId) {
    if (store.isMongo()) {
      const db = await store.getMongoDb()
      const docs = await db.collection('integrations').find({ userId }).toArray()
      return docs.map(d => ({ ...d, config: decryptConfig(d.config) }))
    }
    const settings = await store.getSettings()
    const userConfigs = settings.integrations?.[userId] || {}
    return Object.entries(userConfigs).map(([integrationId, config]) => ({
      userId,
      integrationId,
      config: decryptConfig(config),
    }))
  }

  async refreshOAuthToken(userId, integrationId, refreshToken) {
    // This is a placeholder - real implementation depends on each OAuth provider's refresh flow
    logger.info('OAuth token refresh requested', { userId, integrationId })
    return null
  }
}

export default new ConfigManager()
