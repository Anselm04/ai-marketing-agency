import AIRouter from '../core/ai/AIRouter.js'
import OpenAIProvider from '../core/ai/providers/OpenAIProvider.js'
import AnthropicProvider from '../core/ai/providers/AnthropicProvider.js'
import GoogleProvider from '../core/ai/providers/GoogleProvider.js'
import MistralProvider from '../core/ai/providers/MistralProvider.js'
import OllamaProvider from '../core/ai/providers/OllamaProvider.js'
import AzureOpenAIProvider from '../core/ai/providers/AzureOpenAIProvider.js'
import AWSBedrockProvider from '../core/ai/providers/AWSBedrockProvider.js'
import CohereProvider from '../core/ai/providers/CohereProvider.js'
import logger from '../utils/logger.js'

// Register all providers with the router
AIRouter.registerProvider('openai', OpenAIProvider)
AIRouter.registerProvider('anthropic', AnthropicProvider)
AIRouter.registerProvider('google', GoogleProvider)
AIRouter.registerProvider('mistral', MistralProvider)
AIRouter.registerProvider('ollama', OllamaProvider)
AIRouter.registerProvider('azure', AzureOpenAIProvider)
AIRouter.registerProvider('bedrock', AWSBedrockProvider)
AIRouter.registerProvider('cohere', CohereProvider)

logger.info('AI Service initialized with multi-provider router', {
  providers: Array.from(AIRouter.providers.keys()),
  available: Array.from(AIRouter.providers.entries()).filter(([_, p]) => p.isAvailable()).map(([k]) => k),
})

// System prompts for each agent type
const systemPrompts = {
  'chief-strategy': `You are a Chief Strategy Officer for an AI marketing agency. You analyze business goals, market conditions, and competitive landscapes to create high-level marketing strategies. You focus on ROI, market positioning, and long-term growth. Provide detailed, actionable strategic recommendations.`,
  'social-media': `You are a Social Media Marketing Expert. You create engaging content for platforms like Instagram, TikTok, Twitter, LinkedIn, and Facebook. You understand platform-specific algorithms, best posting times, hashtag strategies, and engagement tactics. Create content that drives engagement and conversions.`,
  'content': `You are a Content Marketing Specialist. You write compelling articles, ad copy, email sequences, landing pages, and SEO-optimized content. You understand audience psychology, conversion copywriting, and search engine optimization. Create content that educates, entertains, and converts.`,
  'seo-aeo': `You are an SEO and AEO (Answer Engine Optimization) Expert. You optimize content for Google, Bing, voice search, and app stores. You understand keyword research, technical SEO, content clusters, and schema markup. Provide comprehensive SEO recommendations and optimized content.`,
  'video': `You are a Video Marketing Producer. You create video scripts, storyboards, and production notes for marketing videos. You understand YouTube SEO, TikTok trends, Instagram Reels, and video advertising. Create scripts that hook viewers in the first 3 seconds and drive action.`,
  'legal-compliance': `You are a Legal and Compliance Expert specializing in marketing law. You review content for GDPR compliance, FTC disclosure requirements, platform-specific ad policies, and international privacy laws. Ensure all marketing content is legally compliant.`,
  'customer-service': `You are a Customer Service and CRM Expert. You write empathetic, effective customer communications, FAQ responses, and chatbot scripts. You understand customer journey mapping, complaint resolution, and retention strategies.`,
  'ai-trainer': `You are an AI Training and Optimization Specialist. You analyze marketing performance data, identify improvement opportunities, and suggest optimizations for AI models and marketing workflows. Focus on data-driven improvements.`,
  'performance-optimizer': `You are a Performance Marketing Analyst. You specialize in A/B testing, conversion rate optimization, campaign analytics, and budget allocation. You analyze metrics and provide specific recommendations to improve ROI.`,
  'market-research': `You are a Market Research Analyst. You analyze market trends, competitor strategies, consumer behavior, and emerging opportunities. You use data to identify untapped markets and growth opportunities.`,
  'automation-coordinator': `You are a Marketing Automation Expert. You design workflows, trigger sequences, and integration strategies to connect marketing tools. You understand Zapier, Make, APIs, and webhook automation.`,
  'agent-oversight': `You are a Quality Assurance Director overseeing AI marketing agents. You review outputs for accuracy, brand consistency, tone appropriateness, and strategic alignment. Provide constructive feedback and improvement suggestions.`,
  'harmony-director': `You are a Marketing Operations Director ensuring all marketing channels work together seamlessly. You coordinate campaigns across platforms, ensure consistent messaging, and optimize cross-channel attribution.`,
  'product-analysis': `You are a Product Marketing Analyst. You analyze product features, benefits, target audiences, and competitive positioning. You create compelling product narratives and marketing angles.`,
  'campaign-strategy': `You are a Campaign Strategy Director. You design comprehensive marketing campaigns with budget allocation, timeline planning, channel selection, and KPI frameworks. You ensure campaigns are measurable and scalable.`,
  'default': `You are an AI marketing assistant. Help create effective marketing content, strategies, and optimizations.`,
}

export async function generateAgentResponse(agentType, task, context, requirements = {}) {
  const systemPrompt = systemPrompts[agentType] || systemPrompts.default
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}` },
  ]

  try {
    const result = await AIRouter.chat(messages, {
      quality: requirements.quality || 'balanced',
      ...requirements,
    })
    return result.result.content
  } catch (err) {
    logger.error('AI service failed', { error: err.message, agentType, task })
    return `[AI Service Error: ${err.message}] Please try again or check your configuration.`
  }
}

export async function generateCampaignStrategy(product, budget, platforms, targetAudience, requirements = {}) {
  const messages = [
    { role: 'system', content: systemPrompts['campaign-strategy'] },
    {
      role: 'user',
      content: `Create a comprehensive marketing campaign strategy for:\n\nProduct: ${JSON.stringify(product)}\nBudget: $${budget}\nPlatforms: ${platforms.join(', ')}\nTarget Audience: ${targetAudience}\n\nReturn a detailed JSON strategy with: strategy summary, budget allocation per platform, timeline, content calendar, KPIs, and creative briefs.`,
    },
  ]

  try {
    const result = await AIRouter.chat(messages, {
      quality: 'premium',
      ...requirements,
    })
    return result.result.content
  } catch (err) {
    logger.error('Campaign strategy generation failed', { error: err.message })
    return JSON.stringify({
      strategy: 'Fallback strategy: Focus on 2-3 primary platforms with organic content and small paid boosts.',
      budgetAllocation: platforms.reduce((acc, p) => ({ ...acc, [p]: Math.floor(budget / platforms.length) }), {}),
      timeline: '30 days',
      kpis: ['Engagement rate', 'Click-through rate', 'Conversions'],
    })
  }
}

export async function generateLegalDocument(type, businessName, jurisdiction, requirements = {}) {
  const messages = [
    { role: 'system', content: systemPrompts['legal-compliance'] },
    {
      role: 'user',
      content: `Generate a ${type} for ${businessName} operating in ${jurisdiction}. Provide the full legal document text.`,
    },
  ]

  try {
    const result = await AIRouter.chat(messages, {
      quality: 'premium',
      ...requirements,
    })
    return result.result.content
  } catch (err) {
    logger.error('Legal document generation failed', { error: err.message })
    return `[Legal Document Template for ${type}] - AI service temporarily unavailable. Please try again.`
  }
}

export async function generateEmbeddings(texts, requirements = {}) {
  try {
    const result = await AIRouter.embeddings(texts, requirements)
    return result.result.embeddings
  } catch (err) {
    logger.error('Embedding generation failed', { error: err.message })
    return texts.map(() => new Array(1536).fill(0))
  }
}

export async function generateVisionResponse(image, prompt, requirements = {}) {
  try {
    const result = await AIRouter.vision(image, prompt, requirements)
    return result.result.content
  } catch (err) {
    logger.error('Vision analysis failed', { error: err.message })
    return `[Vision Analysis Error: ${err.message}]`
  }
}

export async function generateImage(prompt, requirements = {}) {
  try {
    const result = await AIRouter.textToImage(prompt, requirements)
    return result.result
  } catch (err) {
    logger.error('Image generation failed', { error: err.message })
    return null
  }
}

export function getAvailableProviders() {
  return Array.from(AIRouter.providers.entries()).map(([name, provider]) => ({
    name,
    available: provider.isAvailable(),
  }))
}

export function getAvailableModels() {
  return AIRouter.selectModel('chat', {}) || null
}

export { AIRouter }
