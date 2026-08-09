import dotenv from 'dotenv';
import store from '../utils/store.js';
import { logger } from './logger.js';

dotenv.config();

const DEMO_PASSWORD = 'demo123456';

const now = new Date();
const daysAgo = (n) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const campaignTemplates = [
  {
    name: 'Summer App Launch 2024',
    description: 'Multi-platform campaign to promote the new productivity app launch across TikTok, Instagram, and YouTube.',
    status: 'active',
    budget: 50000,
    currency: 'USD',
    startDate: daysAgo(45),
    endDate: daysAgo(15),
    platforms: ['tiktok', 'instagram', 'youtube'],
    targetAudience: { ageRange: '18-34', gender: 'all', interests: ['productivity', 'tech', 'lifestyle'], location: 'US,CA,UK,AU' },
    goals: ['brand_awareness', 'app_installs', 'user_engagement'],
    metrics: { impressions: 2840000, clicks: 142000, conversions: 8900, spend: 42300, ctr: 5.0, cpc: 0.30, roas: 4.2 },
  },
  {
    name: 'Holiday Sale Push',
    description: 'Black Friday and Cyber Monday promotional campaign for the e-commerce store.',
    status: 'completed',
    budget: 25000,
    currency: 'USD',
    startDate: daysAgo(90),
    endDate: daysAgo(60),
    platforms: ['facebook', 'google_ads', 'email'],
    targetAudience: { ageRange: '25-45', gender: 'all', interests: ['shopping', 'deals', 'tech'], location: 'US,CA' },
    goals: ['sales', 'revenue', 'customer_retention'],
    metrics: { impressions: 1560000, clicks: 78000, conversions: 5200, spend: 21800, ctr: 5.0, cpc: 0.28, roas: 5.8 },
  },
  {
    name: 'Influencer Partnership Q1',
    description: 'Micro-influencer campaign targeting health and wellness creators on Instagram and TikTok.',
    status: 'paused',
    budget: 12000,
    currency: 'USD',
    startDate: daysAgo(120),
    endDate: daysAgo(30),
    platforms: ['instagram', 'tiktok'],
    targetAudience: { ageRange: '18-28', gender: 'female', interests: ['wellness', 'fitness', 'nutrition'], location: 'US,UK' },
    goals: ['brand_awareness', 'social_proof', 'community_growth'],
    metrics: { impressions: 890000, clicks: 35600, conversions: 1200, spend: 8900, ctr: 4.0, cpc: 0.25, roas: 3.1 },
  },
  {
    name: 'LinkedIn B2B Lead Gen',
    description: 'Thought leadership and lead generation campaign targeting enterprise decision-makers.',
    status: 'active',
    budget: 35000,
    currency: 'USD',
    startDate: daysAgo(20),
    endDate: daysAgo(-10),
    platforms: ['linkedin', 'google_ads'],
    targetAudience: { ageRange: '30-55', gender: 'all', interests: ['enterprise_software', 'saas', 'digital_transformation'], location: 'US,CA,UK,DE,AU' },
    goals: ['lead_generation', 'brand_awareness', 'demo_requests'],
    metrics: { impressions: 450000, clicks: 18000, conversions: 450, spend: 15400, ctr: 4.0, cpc: 0.86, roas: 6.2 },
  },
  {
    name: 'App Store Optimization',
    description: 'AEO and ASO campaign to improve organic app store visibility and conversion rates.',
    status: 'active',
    budget: 8000,
    currency: 'USD',
    startDate: daysAgo(60),
    endDate: daysAgo(-30),
    platforms: ['app_store', 'google_play'],
    targetAudience: { ageRange: 'all', gender: 'all', interests: ['mobile_apps', 'productivity'], location: 'Global' },
    goals: ['app_installs', 'organic_growth', 'rating_improvement'],
    metrics: { impressions: 2100000, clicks: 189000, conversions: 45300, spend: 6200, ctr: 9.0, cpc: 0.03, roas: 8.5 },
  },
];

const leadTemplates = [
  { name: 'Sarah Chen', email: 's.chen@techcorp.io', company: 'TechCorp Solutions', phone: '+1-555-0123', source: 'linkedin_ad', status: 'qualified', value: 25000, score: 87, tags: ['enterprise', 'saas', 'decision_maker'], notes: 'Interested in enterprise plan. Scheduled demo for next week.' },
  { name: 'Marcus Johnson', email: 'mjohnson@retailplus.com', company: 'Retail Plus Inc', phone: '+1-555-0456', source: 'google_ads', status: 'proposal', value: 12000, score: 92, tags: ['ecommerce', 'high_value', 'urgent'], notes: 'Needs integration with Shopify. Technical requirements sent.' },
  { name: 'Emma Rodriguez', email: 'emma.r@healthyliving.co', company: 'Healthy Living Co', phone: '+1-555-0789', source: 'instagram', status: 'contacted', value: 8000, score: 64, tags: ['wellness', 'influencer', 'content_creator'], notes: 'Referred by existing customer. Looking for affiliate program.' },
  { name: 'David Park', email: 'david.park@fintech.io', company: 'FinTech Innovations', phone: '+1-555-0321', source: 'referral', status: 'new', value: 50000, score: 78, tags: ['fintech', 'enterprise', 'security_focused'], notes: 'Cold outreach from conference. Requested security compliance docs.' },
  { name: 'Lisa Thompson', email: 'lisa@creativeagency.com', company: 'Creative Agency Ltd', phone: '+1-555-0654', source: 'twitter', status: 'qualified', value: 15000, score: 71, tags: ['agency', 'creative', 'bulk_pricing'], notes: 'Wants white-label solution for 15+ clients. Need custom pricing.' },
  { name: 'James Wilson', email: 'jwilson@startup.xyz', company: 'Startup XYZ', phone: '+1-555-0987', source: 'organic', status: 'closed_won', value: 5000, score: 95, tags: ['startup', 'fast_growth', 'champion'], notes: 'Closed deal. Onboarding scheduled. Very enthusiastic about AI features.' },
  { name: 'Aisha Patel', email: 'aisha.p@globalretail.com', company: 'Global Retail Group', phone: '+1-555-0145', source: 'trade_show', status: 'negotiation', value: 85000, score: 89, tags: ['enterprise', 'retail', 'multi_region'], notes: 'Multi-region deployment. Need GDPR compliance. Legal review in progress.' },
  { name: 'Tom Bradley', email: 'tom.b@localbiz.net', company: 'Local Business Network', phone: '+1-555-0278', source: 'facebook', status: 'contacted', value: 2000, score: 45, tags: ['small_business', 'local', 'price_sensitive'], notes: 'Interested in basic plan. Needs payment plan option.' },
  { name: 'Nina Kowalski', email: 'nina.k@edutech.eu', company: 'EduTech Europe', phone: '+33-555-0314', source: 'google_ads', status: 'qualified', value: 18000, score: 82, tags: ['education', 'eu', 'bulk_license'], notes: 'Needs 200+ student licenses. Wants educational discount.' },
  { name: 'Oliver Smith', email: 'oliver@consulting.pro', company: 'Consulting Pro', phone: '+1-555-0567', source: 'referral', status: 'proposal', value: 30000, score: 88, tags: ['consulting', 'b2b', 'integration_heavy'], notes: 'Needs CRM integration. Technical assessment completed.' },
];

const contentTemplates = [
  { title: '10 Ways AI is Revolutionizing Marketing in 2024', type: 'article', platform: 'blog', topic: 'AI marketing trends', tone: 'professional', length: 'long', language: 'en', status: 'published', body: 'Artificial intelligence has fundamentally transformed how businesses approach marketing. From predictive analytics to personalized content generation, AI tools are enabling marketers to achieve unprecedented levels of precision and efficiency. In this article, we explore the top 10 ways AI is reshaping the marketing landscape...' },
  { title: 'Product Launch Teaser', type: 'social', platform: 'instagram', topic: 'New app launch', tone: 'casual', length: 'short', language: 'en', status: 'published', body: 'Something big is coming... 👀 Can you guess what\'s next? Drop your predictions below! 🚀 #ComingSoon #AI #Marketing' },
  { title: 'Weekly Newsletter: Market Insights', type: 'email', platform: 'email', topic: 'Market analysis', tone: 'professional', length: 'medium', language: 'en', status: 'scheduled', body: 'Dear Subscriber,\n\nThis week\'s highlights:\n- AI-driven campaigns saw 40% higher engagement\n- TikTok continues to dominate Gen Z reach\n- New features: real-time analytics dashboard\n\nRead the full report...' },
  { title: 'Case Study: How TechCorp Increased ROI by 300%', type: 'article', platform: 'blog', topic: 'Customer success story', tone: 'professional', length: 'long', language: 'en', status: 'published', body: 'TechCorp Solutions faced a common challenge: scaling their marketing efforts without proportionally increasing their team size. By implementing our AI-powered marketing platform, they achieved remarkable results within just 90 days...' },
  { title: 'Summer Sale Promo Video Script', type: 'script', platform: 'youtube', topic: 'Summer sale promotion', tone: 'urgent', length: 'medium', language: 'en', status: 'draft', body: '[OPENING - 0:00-0:05]\nVisual: Fast-paced montage of summer activities\nVoiceover: This summer, don\'t just dream big. Market bigger.\n\n[HOOK - 0:05-0:15]\nVisual: Dashboard showing AI analytics in action\nVoiceover: What if you could 10x your marketing reach without hiring a single person?' },
  { title: 'Guia de Marketing con IA', type: 'article', platform: 'blog', topic: 'AI marketing guide', tone: 'professional', length: 'long', language: 'es', status: 'published', body: 'La inteligencia artificial ha transformado fundamentalmente la forma en que las empresas abordan el marketing. Desde el análisis predictivo hasta la generación de contenido personalizado...' },
  { title: 'LinkedIn Thought Leadership Post', type: 'social', platform: 'linkedin', topic: 'Industry insights', tone: 'professional', length: 'short', language: 'en', status: 'published', body: 'After analyzing 10,000+ marketing campaigns, here\'s what I learned:\n\n1. Timing matters more than budget\n2. AI-generated content outperforms generic posts by 3x\n3. Authenticity beats polish every time\n\nWhat\'s your biggest marketing insight this year?' },
  { title: 'Holiday Campaign Landing Page', type: 'landing', platform: 'web', topic: 'Holiday promotions', tone: 'urgent', length: 'medium', language: 'en', status: 'published', body: 'This Holiday Season, Give Your Business the Gift of AI-Powered Marketing.\n\nLimited Time Offer: 50% off your first 3 months.\n\nJoin 10,000+ businesses already using our AI marketing platform to grow faster, smarter, and more efficiently.' },
];

const legalDocTemplates = [
  { type: 'terms', title: 'Terms of Service', businessName: 'AI Marketing Agency', jurisdiction: 'Delaware, USA', status: 'active' },
  { type: 'privacy', title: 'Privacy Policy', businessName: 'AI Marketing Agency', jurisdiction: 'GDPR / CCPA', status: 'active' },
  { type: 'gdpr', title: 'GDPR Compliance Statement', businessName: 'AI Marketing Agency', jurisdiction: 'EU', status: 'active' },
  { type: 'cookies', title: 'Cookie Policy', businessName: 'AI Marketing Agency', jurisdiction: 'Global', status: 'active' },
  { type: 'affiliate', title: 'Affiliate Agreement', businessName: 'AI Marketing Agency', jurisdiction: 'Delaware, USA', status: 'draft' },
];

const taskTemplates = [
  { title: 'Review Q3 campaign performance', description: 'Analyze metrics and prepare optimization recommendations for all active campaigns.', status: 'in_progress', priority: 'high', assignedTo: 'performance-optimizer', dueDate: daysAgo(-3) },
  { title: 'Generate social content for next week', description: 'Create 20 social media posts across Instagram, TikTok, and LinkedIn for upcoming product feature launch.', status: 'pending', priority: 'high', assignedTo: 'content', dueDate: daysAgo(-1) },
  { title: 'SEO audit for landing pages', description: 'Run technical SEO audit on all active landing pages and fix critical issues.', status: 'pending', priority: 'medium', assignedTo: 'seo-aeo', dueDate: daysAgo(-5) },
  { title: 'Update legal docs for EU expansion', description: 'Review and update privacy policy, terms of service, and GDPR compliance docs for EU market launch.', status: 'in_progress', priority: 'high', assignedTo: 'legal-compliance', dueDate: daysAgo(-7) },
  { title: 'Draft influencer outreach emails', description: 'Personalize and send outreach emails to 50 micro-influencers in the wellness niche.', status: 'completed', priority: 'medium', assignedTo: 'social-media', dueDate: daysAgo(10) },
  { title: 'Create video ad for app launch', description: 'Produce 30-second and 60-second video ads for the new productivity app feature launch.', status: 'in_progress', priority: 'high', assignedTo: 'video', dueDate: daysAgo(-2) },
  { title: 'Weekly trend analysis report', description: 'Scan market trends and compile actionable insights for the strategy team.', status: 'completed', priority: 'low', assignedTo: 'market-research', dueDate: daysAgo(2) },
  { title: 'Customer support FAQ update', description: 'Review recent support tickets and update FAQ documentation with new answers.', status: 'pending', priority: 'low', assignedTo: 'customer-service', dueDate: daysAgo(-4) },
];

const analyticsData = {
  overview: {
    totalRevenue: 184200,
    totalSpend: 86600,
    totalConversions: 21050,
    totalImpressions: 7840000,
    avgCTR: 5.2,
    avgROAS: 5.6,
    activeCampaigns: 3,
    totalLeads: 142,
  },
  daily: Array.from({ length: 30 }, (_, i) => ({
    date: daysAgo(29 - i).split('T')[0],
    revenue: Math.floor(Math.random() * 3000) + 2000,
    spend: Math.floor(Math.random() * 1500) + 800,
    conversions: Math.floor(Math.random() * 150) + 50,
    impressions: Math.floor(Math.random() * 80000) + 40000,
    clicks: Math.floor(Math.random() * 4000) + 2000,
  })),
  platformBreakdown: {
    tiktok: { impressions: 2100000, clicks: 126000, conversions: 6300, spend: 31500, revenue: 94500 },
    instagram: { impressions: 1560000, clicks: 78000, conversions: 3120, spend: 19500, revenue: 58500 },
    google_ads: { impressions: 1200000, clicks: 36000, conversions: 3600, spend: 16200, revenue: 48600 },
    facebook: { impressions: 890000, clicks: 35600, conversions: 1780, spend: 8900, revenue: 26700 },
    linkedin: { impressions: 450000, clicks: 18000, conversions: 900, spend: 8100, revenue: 24300 },
    youtube: { impressions: 780000, clicks: 23400, conversions: 2340, spend: 7020, revenue: 21060 },
    email: { impressions: 860000, clicks: 43000, conversions: 8600, spend: 3440, revenue: 10320 },
  },
  topPerforming: [
    { campaign: 'Summer App Launch 2024', roas: 4.2, conversions: 8900, revenue: 126000 },
    { campaign: 'Holiday Sale Push', roas: 5.8, conversions: 5200, revenue: 87000 },
    { campaign: 'App Store Optimization', roas: 8.5, conversions: 45300, revenue: 72000 },
  ],
};

async function seed() {
  logger.info('Starting seed process...');

  // Seed agents
  const existingAgents = store.getAgents();
  if (existingAgents.length === 0) {
    store.seedAgents([
      { agentId: 'chief-strategy', name: 'Chief Strategy Agent', role: 'Oversees all operations and revenue generation priorities', category: 'strategy', status: 'active', lastActive: now.toISOString() },
      { agentId: 'social-media', name: 'Social Media Agent', role: 'Creates, schedules, posts, and auto-responds on social platforms', category: 'creative', status: 'active', lastActive: now.toISOString() },
      { agentId: 'content', name: 'Content Agent', role: 'Writes articles, ad copy, SEO text, video scripts', category: 'creative', status: 'active', lastActive: now.toISOString() },
      { agentId: 'seo-aeo', name: 'SEO/AEO Agent', role: 'Manages Google rank, app store AEO', category: 'optimization', status: 'idle', lastActive: now.toISOString() },
      { agentId: 'video', name: 'Video Agent', role: 'Generates engaging video ads, animations, tutorials', category: 'creative', status: 'active', lastActive: now.toISOString() },
      { agentId: 'legal-compliance', name: 'Legal Compliance Agent', role: 'Reviews all marketing for platform, privacy, ad law compliance', category: 'compliance', status: 'active', lastActive: now.toISOString() },
      { agentId: 'customer-service', name: 'Customer Service Agent', role: 'Handles inquiries, feedback, FAQs, issues', category: 'operations', status: 'idle', lastActive: now.toISOString() },
      { agentId: 'ai-trainer', name: 'AI Trainer Agent', role: 'Keeps all agents learning and adapting from user interactions', category: 'meta', status: 'active', lastActive: now.toISOString() },
      { agentId: 'performance-optimizer', name: 'Performance Optimizer', role: 'A/B testing, split testing, and data-driven campaign improvements', category: 'optimization', status: 'idle', lastActive: now.toISOString() },
      { agentId: 'market-research', name: 'Market Research Agent', role: 'Constantly scans trends and market data for new growth opportunities', category: 'strategy', status: 'active', lastActive: now.toISOString() },
      { agentId: 'automation-coordinator', name: 'Automation Coordinator', role: 'Ensures all agents act in sync, without conflicts or drift', category: 'operations', status: 'active', lastActive: now.toISOString() },
      { agentId: 'agent-oversight', name: 'Agent Oversight AI', role: 'Monitors all agents for focus, teamwork, integrity', category: 'meta', status: 'active', lastActive: now.toISOString() },
      { agentId: 'harmony-director', name: 'Harmony Director AI', role: 'Ensures maximum synergy and no wasted effort between agents', category: 'meta', status: 'active', lastActive: now.toISOString() },
    ]);
    logger.info('Seeded 13 AI agents');
  } else {
    logger.info(`Agents already exist (${existingAgents.length}), skipping agent seed`);
  }

  // Seed demo user
  const users = store.getUsers();
  let demoUser;
  if (users.length === 0) {
    const bcrypt = (await import('bcryptjs')).default;
    const hashed = await bcrypt.hash(DEMO_PASSWORD, 12);
    demoUser = await store.createUser({
      email: 'demo@aimarketing.com',
      password: hashed,
      role: 'admin',
      profile: { firstName: 'Demo', lastName: 'Admin', company: 'AI Marketing Agency', timezone: 'UTC', language: 'en' },
    });
    logger.info('Created demo user: demo@aimarketing.com / demo123456');
  } else {
    demoUser = users.find(u => u.email === 'demo@aimarketing.com') || users[0];
    logger.info(`Demo user already exists (${users.length} total users)`);
  }

  // Seed organization
  const orgs = store.getOrganizations();
  let demoOrg;
  if (orgs.length === 0) {
    demoOrg = await store.createOrganization({
      name: 'Demo Marketing Agency',
      ownerId: demoUser.id,
    });
    store.addMember(demoOrg.id, demoUser.id, 'owner');
    logger.info('Created demo organization: Demo Marketing Agency');
  } else {
    demoOrg = orgs[0];
    logger.info(`Organization already exists (${orgs.length} total orgs)`);
  }

  // Seed campaigns
  const existingCampaigns = store.getCampaigns();
  if (existingCampaigns.length === 0) {
    for (const template of campaignTemplates) {
      await store.createCampaign({ ...template, orgId: demoOrg.id, createdBy: demoUser.id });
    }
    logger.info(`Seeded ${campaignTemplates.length} campaigns`);
  } else {
    logger.info(`Campaigns already exist (${existingCampaigns.length}), skipping campaign seed`);
  }

  // Seed leads
  const existingLeads = store.getLeads();
  if (existingLeads.length === 0) {
    for (const template of leadTemplates) {
      await store.createLead({ ...template, orgId: demoOrg.id, createdBy: demoUser.id });
    }
    logger.info(`Seeded ${leadTemplates.length} leads`);
  } else {
    logger.info(`Leads already exist (${existingLeads.length}), skipping lead seed`);
  }

  // Seed content
  const existingContent = store.getContent();
  if (existingContent.length === 0) {
    for (const template of contentTemplates) {
      await store.createContent({ ...template, orgId: demoOrg.id, createdBy: demoUser.id });
    }
    logger.info(`Seeded ${contentTemplates.length} content items`);
  } else {
    logger.info(`Content already exists (${existingContent.length}), skipping content seed`);
  }

  // Seed legal docs
  const existingLegalDocs = store.getLegalDocs();
  if (existingLegalDocs.length === 0) {
    for (const template of legalDocTemplates) {
      await store.createLegalDoc({ ...template, orgId: demoOrg.id, createdBy: demoUser.id });
    }
    logger.info(`Seeded ${legalDocTemplates.length} legal documents`);
  } else {
    logger.info(`Legal docs already exist (${existingLegalDocs.length}), skipping legal doc seed`);
  }

  // Seed tasks
  const existingTasks = store.getTasks();
  if (existingTasks.length === 0) {
    for (const template of taskTemplates) {
      await store.createTask({ ...template, orgId: demoOrg.id, createdBy: demoUser.id });
    }
    logger.info(`Seeded ${taskTemplates.length} tasks`);
  } else {
    logger.info(`Tasks already exist (${existingTasks.length}), skipping task seed`);
  }

  // Seed analytics
  const existingAnalytics = store.getAnalytics();
  if (Object.keys(existingAnalytics).length === 0) {
    await store.setAnalytics('global', analyticsData);
    logger.info('Seeded analytics data');
  } else {
    logger.info('Analytics data already exists, skipping analytics seed');
  }

  // Seed subscription
  const existingSubscriptions = store.getSubscriptions();
  if (existingSubscriptions.length === 0) {
    await store.createSubscription({
      orgId: demoOrg.id,
      plan: 'enterprise',
      status: 'active',
      billingCycle: 'annual',
      amount: 12000,
      currency: 'USD',
      features: ['unlimited_campaigns', 'ai_agents', 'analytics', 'api_access', 'priority_support', 'white_label'],
      maxUsers: 50,
      maxCampaigns: 1000,
      startDate: daysAgo(180),
      endDate: daysAgo(-185),
      autoRenew: true,
    });
    logger.info('Seeded enterprise subscription');
  } else {
    logger.info(`Subscriptions already exist (${existingSubscriptions.length}), skipping subscription seed`);
  }

  logger.info('Seed complete! Demo credentials: demo@aimarketing.com / demo123456');
  process.exit(0);
}

seed().catch(err => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
