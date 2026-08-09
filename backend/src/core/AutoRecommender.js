import logger from '../utils/logger.js'
import ModelRegistry from './ai/ModelRegistry.js'

// Industry benchmarks for platform effectiveness by product category
const categoryPlatformMap = {
  electronics: {
    primary: ['YouTube', 'Reddit', 'Twitter', 'Amazon', 'Google Ads', 'Meta Ads', 'Instagram', 'TikTok'],
    secondary: ['LinkedIn', 'Pinterest', 'Discord', 'Tech Blogs'],
    content: ['video', 'reviews', 'comparison'],
    aiModels: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-1.5-pro'],
  },
  fashion: {
    primary: ['Instagram', 'Pinterest', 'TikTok', 'Shopify', 'Meta Ads', 'Google Ads'],
    secondary: ['YouTube', 'Twitter', 'LinkedIn', 'Fashion Blogs'],
    content: ['visual', 'lifestyle', 'influencer'],
    aiModels: ['gpt-4o', 'dall-e-3', 'claude-3-5-sonnet-20241022'],
  },
  beauty: {
    primary: ['Instagram', 'TikTok', 'YouTube', 'Pinterest', 'Meta Ads', 'Shopify', 'Etsy'],
    secondary: ['Twitter', 'Reddit', 'Facebook', 'Beauty Blogs'],
    content: ['tutorial', 'review', 'before-after'],
    aiModels: ['gpt-4o', 'gemini-1.5-pro', 'dall-e-3'],
  },
  food: {
    primary: ['Instagram', 'TikTok', 'Yelp', 'Google Business', 'Pinterest', 'Meta Ads'],
    secondary: ['YouTube', 'Twitter', 'Reddit', 'Food Blogs'],
    content: ['visual', 'recipe', 'review'],
    aiModels: ['gpt-4o', 'gemini-1.5-flash', 'claude-3-5-haiku-20241022'],
  },
  home: {
    primary: ['Pinterest', 'Instagram', 'Google Ads', 'Meta Ads', 'Amazon', 'Shopify'],
    secondary: ['YouTube', 'Houzz', 'Reddit', 'Home Blogs'],
    content: ['visual', 'tutorial', 'inspiration'],
    aiModels: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-1.5-pro'],
  },
  fitness: {
    primary: ['Instagram', 'TikTok', 'YouTube', 'Meta Ads', 'Google Ads', 'Shopify'],
    secondary: ['Twitter', 'Reddit', 'Strava', 'Fitness Apps'],
    content: ['video', 'tutorial', 'challenge'],
    aiModels: ['gpt-4o', 'gemini-1.5-flash', 'claude-3-5-haiku-20241022'],
  },
  software: {
    primary: ['LinkedIn', 'Twitter', 'Reddit', 'Product Hunt', 'YouTube', 'Google Ads', 'GitHub'],
    secondary: ['Indie Hackers', 'Dev.to', 'Hacker News', 'Discord', 'Slack'],
    content: ['tutorial', 'demo', 'comparison', 'technical'],
    aiModels: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro', 'codestral-latest'],
  },
  b2b: {
    primary: ['LinkedIn', 'Twitter', 'Google Ads', 'HubSpot', 'Salesforce', 'Email', 'YouTube'],
    secondary: ['Reddit', 'Quora', 'Industry Blogs', 'Webinars'],
    content: ['whitepaper', 'case-study', 'webinar', 'demo'],
    aiModels: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'claude-3-opus-20240229'],
  },
  services: {
    primary: ['Facebook', 'Google Ads', 'Yelp', 'LinkedIn', 'Instagram', 'Google Business'],
    secondary: ['Twitter', 'Nextdoor', 'Thumbtack', 'Angi'],
    content: ['testimonial', 'case-study', 'before-after'],
    aiModels: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-1.5-flash'],
  },
  other: {
    primary: ['Instagram', 'Facebook', 'Google Ads', 'Meta Ads', 'Twitter', 'Email'],
    secondary: ['LinkedIn', 'YouTube', 'TikTok', 'Pinterest'],
    content: ['general', 'lifestyle', 'engagement'],
    aiModels: ['gpt-4o-mini', 'gemini-1.5-flash', 'claude-3-5-haiku-20241022'],
  },
}

// Budget allocation strategy
function allocateBudget(budget, platforms) {
  const num = platforms.length
  if (budget <= 500) {
    // Low budget: mostly organic social, 1 paid channel
    return platforms.map((p, i) => ({
      platform: p,
      amount: i === 0 ? Math.floor(budget * 0.6) : Math.floor(budget * 0.4 / (num - 1)),
      type: i === 0 ? 'paid' : 'organic',
    }))
  } else if (budget <= 5000) {
    // Medium budget: 3-5 paid channels
    return platforms.map((p, i) => ({
      platform: p,
      amount: Math.floor(budget / num),
      type: i < 3 ? 'paid' : 'organic',
    }))
  } else {
    // High budget: full funnel
    return platforms.map((p, i) => ({
      platform: p,
      amount: Math.floor(budget / num),
      type: 'paid',
    }))
  }
}

// AI model selection based on task
function selectAIModels(tasks, userTier = 'standard') {
  const models = []
  for (const task of tasks) {
    const taskModelMap = {
      'strategy': { task, modelId: 'claude-3-5-sonnet-20241022', reason: 'Best reasoning and strategic thinking' },
      'creative': { task, modelId: 'gpt-4o', reason: 'Excellent creative writing and brand voice' },
      'optimization': { task, modelId: 'claude-3-5-sonnet-20241022', reason: 'Strong analytical capabilities' },
      'compliance': { task, modelId: 'claude-3-5-sonnet-20241022', reason: 'Precise and careful with legal text' },
      'operations': { task, modelId: 'gpt-4o-mini', reason: 'Fast and cost-effective for routine tasks' },
      'meta': { task, modelId: 'claude-3-opus-20240229', reason: 'Highest capability for complex meta-analysis' },
      'code': { task, modelId: 'codestral-latest', reason: 'Specialized for code generation' },
      'image': { task, modelId: 'dall-e-3', reason: 'Best image generation quality' },
      'vision': { task, modelId: 'gpt-4o', reason: 'Multimodal understanding' },
      'embeddings': { task, modelId: 'text-embedding-3-small', reason: 'Fast and affordable embeddings' },
      'translation': { task, modelId: 'gemini-1.5-pro', reason: 'Excellent multilingual capabilities' },
      'summarization': { task, modelId: 'gemini-1.5-flash', reason: 'Fast with huge context window' },
      'reasoning': { task, modelId: 'claude-3-5-sonnet-20241022', reason: 'Best reasoning capabilities' },
    }

    const modelRec = taskModelMap[task] || { task, modelId: 'gpt-4o-mini', reason: 'General purpose' }
    const model = ModelRegistry.getById(modelRec.modelId)
    if (model) {
      models.push({
        ...modelRec,
        name: model.name,
        estimatedCost: model.costPer1KInput + model.costPer1KOutput,
      })
    }
  }
  return models
}

class AutoRecommender {
  async recommendCampaign(userId, productProfile, campaignGoals = {}) {
    const {
      category = 'other',
      budget = 1000,
      targetAudience = 'general consumers',
      productName = 'Product',
      goals = ['awareness', 'engagement'],
    } = productProfile || {}

    const categoryData = categoryPlatformMap[category] || categoryPlatformMap.other

    // Select platforms based on budget and category
    let numPlatforms = 3
    if (budget >= 5000) numPlatforms = 6
    if (budget >= 10000) numPlatforms = 8

    const selectedPlatforms = categoryData.primary.slice(0, numPlatforms)
    const secondaryPlatforms = categoryData.secondary.slice(0, 3)

    const allPlatforms = [...selectedPlatforms, ...secondaryPlatforms]

    // Budget allocation
    const budgetAllocation = allocateBudget(budget, allPlatforms)

    // AI models needed
    const tasks = ['strategy', 'creative', 'optimization', 'operations']
    if (goals.includes('awareness')) tasks.push('image', 'vision')
    if (goals.includes('engagement')) tasks.push('creative', 'operations')
    if (goals.includes('conversion')) tasks.push('optimization', 'reasoning')

    const aiModels = selectAIModels(tasks)

    // Content strategy
    const contentTypes = categoryData.content

    // Timeline
    const timeline = budget < 1000 ? '2 weeks' : budget < 5000 ? '1 month' : '3 months'

    // KPIs
    const kpis = goals.includes('awareness')
      ? ['Impressions', 'Reach', 'Brand Mentions', 'Share of Voice']
      : goals.includes('engagement')
        ? ['Engagement Rate', 'Click-Through Rate', 'Time on Site', 'Social Shares']
        : goals.includes('conversion')
          ? ['Conversion Rate', 'Cost Per Acquisition', 'Return on Ad Spend', 'Revenue']
          : ['Engagement Rate', 'Reach', 'Conversion Rate']

    return {
      aiModels: aiModels.map(m => ({
        task: m.task,
        modelId: m.modelId,
        name: m.name,
        reason: m.reason,
        estimatedCost: `$${m.estimatedCost.toFixed(4)} per 1K tokens`,
      })),
      apps: allPlatforms.map((platform, i) => ({
        appId: platform.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: platform,
        category: i < selectedPlatforms.length ? 'primary' : 'secondary',
        reason: `${i < selectedPlatforms.length ? 'Primary' : 'Secondary'} channel for ${category} products targeting ${targetAudience}`,
        priority: i < selectedPlatforms.length ? 'high' : 'medium',
        estimatedReach: i < selectedPlatforms.length ? 'High' : 'Medium',
      })),
      strategy: {
        timeline,
        budgetAllocation,
        contentTypes,
        kpis,
        phases: [
          { name: 'Setup & Launch', duration: '1 week', activities: ['Connect platforms', 'Create content', 'Set up tracking'] },
          { name: 'Growth & Optimization', duration: timeline === '2 weeks' ? '1 week' : '2 weeks', activities: ['Publish content', 'Monitor performance', 'A/B test creative'] },
          { name: 'Scale & Refine', duration: 'ongoing', activities: ['Double down on winners', 'Cut underperformers', 'Expand to new channels'] },
        ],
      },
    }
  }

  async recommendNextAction(userId, userState = {}) {
    const {
      connectedIntegrations = 0,
      totalIntegrations = 25,
      campaignsCreated = 0,
      hasPaymentMethod = false,
      teamMembers = 1,
    } = userState

    const recommendations = []

    if (connectedIntegrations < 3) {
      recommendations.push({
        action: 'connect_integrations',
        title: 'Connect Your First 3 Platforms',
        description: `You have ${connectedIntegrations} platforms connected. Connect at least 3 to start publishing campaigns.`,
        priority: 'high',
        icon: 'Link',
        cta: 'Go to Integration Hub',
      })
    }

    if (campaignsCreated === 0) {
      recommendations.push({
        action: 'create_campaign',
        title: 'Create Your First Campaign',
        description: 'No campaigns yet. Upload a product photo and let AI generate your first marketing campaign.',
        priority: 'high',
        icon: 'Rocket',
        cta: 'Create Campaign',
      })
    }

    if (!hasPaymentMethod) {
      recommendations.push({
        action: 'add_payment',
        title: 'Add Payment Method',
        description: 'Add a payment method to unlock premium features and higher campaign limits.',
        priority: 'medium',
        icon: 'CreditCard',
        cta: 'Add Payment',
      })
    }

    if (teamMembers === 1) {
      recommendations.push({
        action: 'invite_team',
        title: 'Invite Team Members',
        description: 'Collaborate with your team. Invite colleagues to manage campaigns together.',
        priority: 'low',
        icon: 'Users',
        cta: 'Invite Team',
      })
    }

    if (connectedIntegrations >= 3 && campaignsCreated > 0) {
      recommendations.push({
        action: 'optimize',
        title: 'Optimize Your Campaigns',
        description: 'AI detected optimization opportunities. Review recommendations to improve ROI.',
        priority: 'medium',
        icon: 'TrendingUp',
        cta: 'View Recommendations',
      })
    }

    return recommendations
  }

  async recommendModels(task, requirements = {}) {
    const taskModes = {
      'chat': 'chat',
      'creative': 'chat',
      'vision': 'vision',
      'embeddings': 'embeddings',
      'image': 'image',
      'code': 'chat',
      'reasoning': 'chat',
    }

    const mode = taskModes[task] || 'chat'
    const models = ModelRegistry.getByMode(mode)

    // Filter by requirements
    let filtered = models
    if (requirements.maxCost) {
      filtered = filtered.filter(m => m.costPer1KInput + m.costPer1KOutput <= requirements.maxCost)
    }
    if (requirements.minQuality) {
      filtered = filtered.filter(m => m.qualityScore >= requirements.minQuality)
    }
    if (requirements.preferredProvider) {
      filtered = filtered.filter(m => m.provider === requirements.preferredProvider)
    }

    // Sort by score
    const scored = filtered.map(m => {
      const score = m.qualityScore * 3 + m.speedScore * 2 + m.reliabilityScore * 2 - (m.costPer1KInput + m.costPer1KOutput) * 10
      return { ...m, score }
    }).sort((a, b) => b.score - a.score)

    return scored.slice(0, 5).map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      qualityScore: m.qualityScore,
      speedScore: m.speedScore,
      costPer1K: m.costPer1KInput + m.costPer1KOutput,
      maxTokens: m.maxTokens,
      reason: `Quality: ${m.qualityScore}/10, Speed: ${m.speedScore}/10, Cost: $${(m.costPer1KInput + m.costPer1KOutput).toFixed(4)}/1K tokens`,
    }))
  }
}

export default new AutoRecommender()
