import { getMongoDB } from '../config/mongodb.js'
import store from '../utils/store.js'
import logger from '../utils/logger.js'

const migrations = [
  {
    name: '001_initial_schema',
    async up(db) {
      // Indexes are already created in connectMongoDB, but we can add any additional schema setup here
      logger.info('Migration 001: Initial schema setup complete')
    },
  },
  {
    name: '002_add_integration_configs',
    async up(db) {
      await db.collection('integrations').createIndex({ userId: 1, integrationId: 1 }, { unique: true })
      await db.collection('integrations').createIndex({ userId: 1 })
      logger.info('Migration 002: Integration configs collection ready')
    },
  },
  {
    name: '003_add_recommendation_feedback',
    async up(db) {
      await db.collection('recommendations').createIndex({ userId: 1, createdAt: -1 })
      await db.collection('recommendations').createIndex({ userId: 1, accepted: 1 })
      logger.info('Migration 003: Recommendation feedback collection ready')
    },
  },
  {
    name: '004_add_ai_usage_logs',
    async up(db) {
      await db.collection('aiUsage').createIndex({ userId: 1, createdAt: -1 })
      await db.collection('aiUsage').createIndex({ provider: 1, model: 1, createdAt: -1 })
      logger.info('Migration 004: AI usage logs collection ready')
    },
  },
  {
    name: '005_add_campaign_performance',
    async up(db) {
      await db.collection('campaignPerformance').createIndex({ campaignId: 1, date: -1 })
      await db.collection('campaignPerformance').createIndex({ userId: 1, date: -1 })
      logger.info('Migration 005: Campaign performance collection ready')
    },
  },
]

export async function runMigrations() {
  try {
    const isMongo = store.isMongo()
    if (!isMongo) {
      logger.info('JSON store mode: skipping migrations')
      return
    }

    const db = getMongoDB()
    const appliedMigrations = await db.collection('migrations').find().toArray()
    const appliedNames = new Set(appliedMigrations.map(m => m.name))

    for (const migration of migrations) {
      if (!appliedNames.has(migration.name)) {
        logger.info(`Running migration: ${migration.name}`)
        try {
          await migration.up(db)
          await db.collection('migrations').insertOne({
            name: migration.name,
            appliedAt: new Date().toISOString(),
          })
          logger.info(`Migration ${migration.name} applied successfully`)
        } catch (err) {
          logger.error(`Migration ${migration.name} failed`, { error: err.message })
          throw err
        }
      }
    }

    logger.info('All migrations complete')
  } catch (err) {
    logger.error('Migration runner failed', { error: err.message })
    throw err
  }
}

export default runMigrations
