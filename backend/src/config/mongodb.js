import { MongoClient, ObjectId } from 'mongodb'
import logger from '../utils/logger.js'

let client = null
let db = null

export async function connectMongoDB() {
  if (client) return db

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_marketing_agency'
  const dbName = process.env.MONGODB_DB_NAME || 'ai_marketing_agency'

  try {
    client = new MongoClient(uri, {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE, 10) || 50,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
      readPreference: 'primaryPreferred',
    })

    await client.connect()
    db = client.db(dbName)

    // Ensure indexes for common queries
    await db.collection('users').createIndex({ email: 1 }, { unique: true })
    await db.collection('users').createIndex({ createdAt: -1 })
    await db.collection('campaigns').createIndex({ ownerId: 1, createdAt: -1 })
    await db.collection('campaigns').createIndex({ status: 1 })
    await db.collection('content').createIndex({ ownerId: 1, createdAt: -1 })
    await db.collection('leads').createIndex({ ownerId: 1, status: 1, createdAt: -1 })
    await db.collection('leads').createIndex({ email: 1 })
    await db.collection('agents').createIndex({ agentId: 1 }, { unique: true })
    await db.collection('orgs').createIndex({ ownerId: 1 })
    await db.collection('orgs').createIndex({ 'members.userId': 1 })
    await db.collection('invites').createIndex({ token: 1 }, { unique: true })
    await db.collection('invites').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    await db.collection('subscriptions').createIndex({ userId: 1 }, { unique: true })
    await db.collection('analytics').createIndex({ key: 1 }, { unique: true })
    await db.collection('settings').createIndex({ key: 1 }, { unique: true })
    await db.collection('integrations').createIndex({ userId: 1, integrationId: 1 }, { unique: true })
    await db.collection('integrations').createIndex({ userId: 1 })
    await db.collection('payments').createIndex({ userId: 1, createdAt: -1 })
    await db.collection('tasks').createIndex({ ownerId: 1, status: 1, createdAt: -1 })
    await db.collection('messages').createIndex({ leadId: 1, createdAt: -1 })
    await db.collection('messages').createIndex({ userId: 1, createdAt: -1 })
    await db.collection('migrations').createIndex({ name: 1 }, { unique: true })

    logger.info('MongoDB connected with indexes', { dbName, poolSize: 50 })
    return db
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message })
    throw err
  }
}

export function getMongoDB() {
  return db
}

export function getMongoClient() {
  return client
}

export function toMongoId(val) {
  if (!val) return val
  if (val instanceof ObjectId) return val
  if (ObjectId.isValid(val)) return new ObjectId(val)
  return val
}

export function stripMongo(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return { id: _id?.toString?.() || _id, ...rest }
}

export async function disconnectMongoDB() {
  if (client) {
    await client.close()
    client = null
    db = null
    logger.info('MongoDB disconnected gracefully')
  }
}

export function mongoStatus() {
  return {
    connected: !!client && !!db,
    poolSize: client?.options?.maxPoolSize || 0,
  }
}
