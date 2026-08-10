import dotenv from 'dotenv';
import store from '../utils/store.js';

dotenv.config();

async function seed() {
  store.seedAgents([
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
  ]);
  console.log('Seeded default agents');

  const users = store.getUsers();
  if (users.length === 0) {
    const hashed = await store.comparePassword('admin123', 'admin123'); // just a placeholder check
    // Actually we need bcrypt import here for seed
    const bcrypt = (await import('bcryptjs')).default;
    const hashed = await bcrypt.hash('admin123', 12);
    store.createUser({
      email: 'admin@aimarketing.com',
      password: hashed,
      role: 'admin',
      profile: { firstName: 'Admin', lastName: 'User', company: 'AI Marketing Agency' },
    });
    console.log('Seeded admin user: admin@aimarketing.com / admin123');
  }

  console.log('Seed complete');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
