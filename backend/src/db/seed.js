import { getMongoDB } from '../config/mongodb.js'
import store from '../utils/store.js'
import bcrypt from 'bcryptjs'
import logger from '../utils/logger.js'

export async function seedDatabase() {
  try {
    const isMongo = store.isMongo()
    if (!isMongo) {
      logger.info('JSON store mode: skipping MongoDB seed')
      return
    }

    const db = getMongoDB()

    // Check if already seeded
    const userCount = await db.collection('users').countDocuments()
    if (userCount > 0) {
      logger.info('Database already seeded, skipping')
      return
    }

    logger.info('Seeding database...')

    // Seed admin user
    const adminPassword = await bcrypt.hash('admin123', 12)
    const adminUser = {
      id: 'admin-seed-001',
      email: 'admin@aimarketing.com',
      password: adminPassword,
      role: 'admin',
      profile: { firstName: 'Admin', lastName: 'User', company: 'AI Marketing Agency' },
      createdAt: new Date().toISOString(),
    }
    await db.collection('users').insertOne(adminUser)

    // Seed demo organization
    const org = {
      id: 'org-seed-001',
      name: 'Demo Marketing Agency',
      ownerId: adminUser.id,
      members: [
        { userId: adminUser.id, role: 'owner', joinedAt: new Date().toISOString() },
      ],
      createdAt: new Date().toISOString(),
    }
    await db.collection('orgs').insertOne(org)

    // Seed agents
    const defaultAgents = [
      { agentId: 'chief-strategy', name: 'Chief Strategy Agent', role: 'Oversees all operations and revenue generation priorities', category: 'strategy', status: 'active', lastActive: new Date().toISOString() },
      { agentId: 'social-media', name: 'Social Media Agent', role: 'Creates, schedules, posts, and auto-responds on social platforms', category: 'creative', status: 'active', lastActive: new Date().toISOString() },
      { agentId: 'content', name: 'Content Agent', role: 'Writes articles, ad copy, SEO text, video scripts', category: 'creative', status: 'active', lastActive: new Date().toISOString() },
      { agentId: 'seo-aeo', name: 'SEO/AEO Agent', role: 'Manages Google rank, app store AEO', category: 'optimization', status: 'idle', lastActive: new Date().toISOString() },
      { agentId: 'video', name: 'Video Agent', role: 'Generates engaging video ads, animations, tutorials', category: 'creative', status: 'active', lastActive: new Date().toISOString() },
      { agentId: 'legal-compliance', name: 'Legal Compliance Agent', role: 'Reviews all marketing for platform, privacy, ad law compliance', category: 'compliance', status: 'active', lastActive: new Date().toISOString() },
      { agentId: 'customer-service', name: 'Customer Service Agent', role: 'Handles inquiries, feedback, FAQs, issues', category: 'operations', status: 'idle', lastActive: new Date().toISOString() },
      { agentId: 'ai-trainer', name: 'AI Trainer Agent', role: 'Keeps all agents learning and adapting from user interactions', category: 'meta', status: 'active', lastActive: new Date().toISOString() },
      { agentId: 'performance-optimizer', name: 'Performance Optimizer', role: 'A/B testing, split testing, and data-driven campaign improvements', category: 'optimization', status: 'idle', lastActive: new Date().toISOString() },
      { agentId: 'market-research', name: 'Market Research Agent', role: 'Constantly scans trends and market data for new growth opportunities', category: 'strategy', status: 'active', lastActive: new Date().toISOString() },
      { agentId: 'automation-coordinator', name: 'Automation Coordinator', role: 'Ensures all agents act in sync, without conflicts or drift', category: 'operations', status: 'active', lastActive: new Date().toISOString() },
      { agentId: 'agent-oversight', name: 'Agent Oversight AI', role: 'Monitors all agents for focus, teamwork, integrity', category: 'meta', status: 'active', lastActive: new Date().toISOString() },
      { agentId: 'harmony-director', name: 'Harmony Director AI', role: 'Ensures maximum synergy and no wasted effort between agents', category: 'meta', status: 'active', lastActive: new Date().toISOString() },
    ]
    await db.collection('agents').insertMany(defaultAgents.map(a => ({ ...a, createdAt: new Date().toISOString() })))

    // Seed sample campaigns
    const sampleCampaigns = [
      {
        id: 'camp-seed-001',
        ownerId: adminUser.id,
        name: 'Summer Product Launch',
        status: 'active',
        platforms: ['Instagram', 'TikTok', 'Facebook'],
        budget: 5000,
        spent: 1250,
        revenue: 8500,
        roi: 5.8,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'camp-seed-002',
        ownerId: adminUser.id,
        name: 'Holiday Sale Campaign',
        status: 'paused',
        platforms: ['Google', 'YouTube', 'Email'],
        budget: 10000,
        spent: 3200,
        revenue: 15000,
        roi: 3.7,
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]
    await db.collection('campaigns').insertMany(sampleCampaigns)

    // Seed sample leads
    const sampleLeads = [
      { id: 'lead-seed-001', ownerId: adminUser.id, name: 'Sarah Johnson', email: 'sarah@example.com', status: 'qualified', score: 85, source: 'Instagram', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'lead-seed-002', ownerId: adminUser.id, name: 'Mike Chen', email: 'mike@example.com', status: 'new', score: 45, source: 'Website', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'lead-seed-003', ownerId: adminUser.id, name: 'Emma Davis', email: 'emma@example.com', status: 'contacted', score: 72, source: 'LinkedIn', createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() },
    ]
    await db.collection('leads').insertMany(sampleLeads)

    // Seed content items
    const sampleContent = [
      { id: 'content-seed-001', ownerId: adminUser.id, type: 'article', title: '10 Ways AI is Revolutionizing Marketing', status: 'published', platforms: ['Blog', 'LinkedIn'], createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'content-seed-002', ownerId: adminUser.id, type: 'ad', title: 'Summer Sale Ad Copy', status: 'ready', platforms: ['Instagram', 'Facebook'], createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'content-seed-003', ownerId: adminUser.id, type: 'script', title: 'Product Demo Video Script', status: 'draft', platforms: ['YouTube', 'TikTok'], createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    ]
    await db.collection('content').insertMany(sampleContent)

    logger.info('Database seeded successfully', { users: 1, orgs: 1, agents: 13, campaigns: 2, leads: 3, content: 3 })
  } catch (err) {
    logger.error('Database seeding failed', { error: err.message })
    throw err
  }
}

export default seedDatabase
