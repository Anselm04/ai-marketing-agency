/**
 * Intelligent Orchestrator Service
 * Automatically selects the optimal AI model and app connectors for each user
 * based on task context, user preferences, cost optimization, and historical performance.
 *
 * Features:
 * - User context analysis (industry, goals, team size, budget, connected apps)
 * - Task-to-model matching (quality, speed, cost, context window)
 * - Task-to-connector matching (active connections, health, rate limits)
 * - Dynamic recommendation engine (suggest new connectors based on patterns)
 * - Cost optimization (route to cheapest model meeting quality threshold)
 * - Fallback chains (model fails -> next best; connector fails -> queue for retry)
 * - Learning from user feedback and outcomes over time
 */

import { aiModelRegistry } from './aiModelRegistry.js';
import { allConnectors, getConnectorById } from './connectors/index.js';
import {
  getTokens,
  getHealthStatus,
  connectorRequest,
  checkRateLimit,
} from './appConnector.js';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';
import { addJob, QueueNames } from '../utils/queue.js';
import { sendNotification } from '../utils/websocket.js';

// ------------------------------------------------------------------
// Task classification
// ------------------------------------------------------------------

const TASK_CLASSIFICATIONS = {
  // Marketing tasks
  'campaign-strategy': { category: 'marketing', complexity: 'high', urgency: 'medium', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o', 'claude-3-5-sonnet'] },
  'social-post': { category: 'marketing', complexity: 'low', urgency: 'high', preferredProviders: ['openai', 'groq'], preferredModels: ['gpt-4o-mini', 'llama-3.1-8b-instant'] },
  'content-generation': { category: 'creative', complexity: 'medium', urgency: 'medium', preferredProviders: ['openai', 'anthropic', 'google'], preferredModels: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro'] },
  'seo-optimization': { category: 'analysis', complexity: 'medium', urgency: 'low', preferredProviders: ['openai', 'google'], preferredModels: ['gpt-4o-mini', 'gemini-1.5-flash'] },
  'ad-copy': { category: 'marketing', complexity: 'medium', urgency: 'high', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o', 'claude-3-haiku'] },
  'email-campaign': { category: 'marketing', complexity: 'medium', urgency: 'medium', preferredProviders: ['openai', 'cohere'], preferredModels: ['gpt-4o-mini', 'command-r'] },

  // Legal tasks
  'legal-document': { category: 'legal', complexity: 'high', urgency: 'medium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-3-5-sonnet', 'gpt-4o'] },
  'contract-review': { category: 'legal', complexity: 'high', urgency: 'high', preferredProviders: ['anthropic'], preferredModels: ['claude-3-opus'] },
  'gdpr-compliance': { category: 'legal', complexity: 'high', urgency: 'low', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-3-5-sonnet', 'gpt-4o'] },

  // Creative tasks
  'video-script': { category: 'creative', complexity: 'medium', urgency: 'medium', preferredProviders: ['openai', 'google'], preferredModels: ['gpt-4o', 'gemini-1.5-pro'] },
  'storyboard': { category: 'creative', complexity: 'medium', urgency: 'low', preferredProviders: ['openai'], preferredModels: ['gpt-4o'] },
  'product-description': { category: 'creative', complexity: 'low', urgency: 'medium', preferredProviders: ['openai', 'groq'], preferredModels: ['gpt-4o-mini', 'llama-3.1-8b-instant'] },

  // Analysis tasks
  'data-analysis': { category: 'analysis', complexity: 'high', urgency: 'low', preferredProviders: ['openai', 'google'], preferredModels: ['gpt-4o', 'gemini-1.5-pro'] },
  'trend-prediction': { category: 'analysis', complexity: 'high', urgency: 'medium', preferredProviders: ['openai', 'google'], preferredModels: ['gpt-4o', 'gemini-1.5-pro'] },
  'lead-scoring': { category: 'analysis', complexity: 'medium', urgency: 'high', preferredProviders: ['openai', 'groq'], preferredModels: ['gpt-4o-mini', 'llama-3.1-70b-versatile'] },
  'competitor-analysis': { category: 'analysis', complexity: 'high', urgency: 'low', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o', 'claude-3-5-sonnet'] },

  // Translation tasks
  'translation': { category: 'translation', complexity: 'low', urgency: 'medium', preferredProviders: ['google', 'openai'], preferredModels: ['gemini-1.5-flash', 'gpt-4o-mini'] },
  'bulk-translation': { category: 'translation', complexity: 'medium', urgency: 'low', preferredProviders: ['google', 'openai'], preferredModels: ['gemini-1.5-pro', 'gpt-4o'] },

  // Code/Technical tasks
  'code-generation': { category: 'code', complexity: 'high', urgency: 'medium', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o', 'claude-3-5-sonnet'] },
  'api-integration': { category: 'code', complexity: 'high', urgency: 'high', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o', 'claude-3-5-sonnet'] },
  'automation-script': { category: 'code', complexity: 'medium', urgency: 'medium', preferredProviders: ['openai', 'groq'], preferredModels: ['gpt-4o-mini', 'llama-3.1-70b-versatile'] },

  // Default
  'default': { category: 'default', complexity: 'medium', urgency: 'medium', preferredProviders: ['openai'], preferredModels: ['gpt-4o-mini'] },
};

// ------------------------------------------------------------------
// Connector mapping by task category
// ------------------------------------------------------------------

const CONNECTOR_RECOMMENDATIONS = {
  'marketing': ['meta_facebook', 'meta_instagram', 'twitter_x', 'linkedin', 'tiktok', 'pinterest', 'google_ads', 'meta_ads', 'mailchimp', 'sendgrid', 'klaviyo'],
  'social': ['meta_facebook', 'meta_instagram', 'twitter_x', 'linkedin', 'tiktok', 'pinterest', 'threads', 'bluesky', 'snapchat', 'reddit'],
  'ecommerce': ['shopify', 'woocommerce', 'bigcommerce', 'stripe_connect', 'square', 'paypal', 'amazon_sp_api', 'etsy', 'gumroad'],
  'content': ['wordpress', 'medium', 'substack', 'ghost', 'wix', 'squarespace', 'webflow', 'youtube'],
  'analytics': ['google_analytics', 'mixpanel', 'segment', 'amplitude', 'semrush', 'ahrefs', 'moz'],
  'crm': ['hubspot', 'salesforce', 'pipedrive', 'zoho_crm', 'activecampaign', 'mailchimp', 'klaviyo', 'intercom', 'zendesk'],
  'messaging': ['twilio', 'sendgrid', 'mailgun', 'onesignal', 'intercom', 'slack', 'discord', 'whatsapp_business', 'telegram'],
  'audio': ['spotify', 'apple_podcasts', 'anchor', 'soundcloud', 'buzzsprout', 'libsyn', 'podbean'],
  'legal': [],
  'creative': ['meta_facebook', 'meta_instagram', 'twitter_x', 'youtube', 'pinterest', 'wordpress', 'medium'],
  'code': ['github', 'gitlab', 'bitbucket'],
  'reviews': ['trustpilot', 'yelp', 'google_reviews', 'g2', 'capterra', 'tripadvisor'],
  'default': ['meta_facebook', 'twitter_x', 'google_ads', 'shopify', 'mailchimp', 'google_analytics'],
};

// ------------------------------------------------------------------
// Orchestrator
// ------------------------------------------------------------------

export class IntelligentOrchestrator {
  constructor() {
    this.userProfiles = new Map(); // In-memory profiles (should be persisted in DB)
    this.taskHistory = new Map(); // Task execution history per user
    this.connectorSuggestions = new Map(); // Suggested connectors per user
  }

  /**
   * Build or update a user profile for intelligent routing.
   */
  async buildUserProfile(userId, userData) {
    const profile = {
      userId,
      industry: userData.industry || 'general',
      companySize: userData.companySize || 'small',
      budget: userData.budget || 'standard',
      goals: userData.goals || [],
      preferredTone: userData.preferredTone || 'professional',
      language: userData.language || 'en',
      timezone: userData.timezone || 'UTC',
      connectedConnectors: [],
      aiPreferences: userData.aiPreferences || {},
      lastUpdated: Date.now(),
    };

    // Discover connected connectors
    for (const connector of allConnectors) {
      const tokens = await getTokens(userId, connector.id);
      if (tokens) {
        profile.connectedConnectors.push({
          id: connector.id,
          name: connector.name,
          category: connector.category,
          health: getHealthStatus(connector.id),
        });
      }
    }

    this.userProfiles.set(userId, profile);
    await cache.set(`user-profile:${userId}`, profile, 3600, 'orchestrator');
    return profile;
  }

  /**
   * Get user profile (from cache or memory).
   */
  async getUserProfile(userId) {
    const cached = await cache.get(`user-profile:${userId}`, 'orchestrator');
    if (cached) return cached;
    return this.userProfiles.get(userId) || null;
  }

  /**
   * Classify a task based on its type and content.
   */
  classifyTask(taskType, content = '') {
    const classification = TASK_CLASSIFICATIONS[taskType] || TASK_CLASSIFICATIONS['default'];

    // Adjust complexity based on content length
    const contentLength = content.length;
    if (contentLength > 10000) classification.complexity = 'high';
    else if (contentLength > 3000) classification.complexity = 'medium';
    else classification.complexity = 'low';

    return classification;
  }

  /**
   * Select the optimal AI model for a task.
   */
  async selectModel(userId, taskType, content = '', options = {}) {
    const classification = this.classifyTask(taskType, content);
    const profile = await this.getUserProfile(userId);

    const userPrefs = profile?.aiPreferences || {};
    const costOptimization = userPrefs.costOptimization !== false;
    const qualityThreshold = userPrefs.qualityThreshold || 0.7;
    const fallbackChain = userPrefs.fallbackChain || [];

    // Get all available models
    const allModels = aiModelRegistry.getAllModels();
    const availableModels = allModels.filter((m) => {
      const provider = aiModelRegistry.getProvider(m.providerId);
      return provider?.isAvailable() && m.quality >= qualityThreshold;
    });

    if (availableModels.length === 0) {
      throw new Error('No AI models available. Please configure an AI provider.');
    }

    // Score each model for this specific task
    const contentLength = content.length;
    const estimatedTokens = Math.ceil(contentLength / 4);
    const scoredModels = availableModels.map((model) => {
      let score = 0;

      // Quality match
      score += model.quality * 0.35;

      // Speed match (higher urgency = more weight on speed)
      const urgencyWeight = classification.urgency === 'high' ? 0.3 : classification.urgency === 'medium' ? 0.2 : 0.1;
      score += model.speed * urgencyWeight;

      // Cost optimization (if enabled, prefer cheaper models)
      if (costOptimization) {
        const costScore = model.cost || 0.5;
        score += costScore * 0.25;
      } else {
        score += model.quality * 0.25;
      }

      // Provider preference boost
      if (classification.preferredProviders?.includes(model.providerId)) {
        score += 0.15;
      }
      if (classification.preferredModels?.includes(model.id)) {
        score += 0.1;
      }

      // User preference boost
      if (userPrefs.defaultProvider === model.providerId) {
        score += 0.05;
      }
      if (userPrefs.defaultModel === model.id) {
        score += 0.05;
      }

      // Context window fit (for long content)
      if (model.context && estimatedTokens > model.context * 0.8) {
        score -= 0.3; // Penalize if content is too long for context window
      }

      return { ...model, score: Math.round(score * 100) / 100 };
    });

    // Sort by score
    scoredModels.sort((a, b) => b.score - a.score);

    const selected = scoredModels[0];
    const alternatives = scoredModels.slice(1, 4).map((m) => ({
      id: m.id,
      provider: m.providerId,
      name: m.name,
      score: m.score,
      cost: aiModelRegistry.estimateCost(m.providerId, m.id, 1000, 1000),
    }));

    logger.info(`Model selected for user ${userId}: ${selected.id} (${selected.providerId}) score=${selected.score}`, {
      taskType,
      classification: classification.category,
      complexity: classification.complexity,
    });

    return {
      modelId: selected.id,
      providerId: selected.providerId,
      modelName: selected.name,
      score: selected.score,
      estimatedCost: aiModelRegistry.estimateCost(selected.providerId, selected.id, 1000, 1000),
      alternatives,
      fallbackChain: fallbackChain.length > 0 ? fallbackChain : alternatives.map((a) => a.id),
      context: {
        taskType,
        classification,
        contentLength,
        estimatedTokens,
      },
    };
  }

  /**
   * Select optimal connectors for a task.
   */
  async selectConnectors(userId, taskType, requiredOperations = []) {
    const classification = this.classifyTask(taskType);
    const profile = await this.getUserProfile(userId);
    const connected = profile?.connectedConnectors || [];

    // Get recommended connector IDs for this task category
    const recommendedIds = CONNECTOR_RECOMMENDATIONS[classification.category] || CONNECTOR_RECOMMENDATIONS['default'];

    const selected = [];
    const missing = [];
    const suggestions = [];

    for (const connectorId of recommendedIds) {
      const connector = getConnectorById(connectorId);
      if (!connector) continue;

      const connectedInfo = connected.find((c) => c.id === connectorId);
      const health = getHealthStatus(connectorId);

      if (connectedInfo) {
        // Check if connector is healthy
        if (health.status === 'up' || health.status === 'degraded') {
          // Check if required operations are supported
          const supportedOps = requiredOperations.filter((op) =>
            connector.operations.some((o) => o.id === op)
          );

          if (requiredOperations.length === 0 || supportedOps.length > 0) {
            selected.push({
              id: connectorId,
              name: connector.name,
              category: connector.category,
              health: health.status,
              supportedOperations: supportedOps,
              score: this.scoreConnector(connector, classification, connectedInfo),
            });
          }
        }
      } else {
        missing.push({
          id: connectorId,
          name: connector.name,
          category: connector.category,
          relevance: this.scoreConnectorRelevance(connector, classification),
        });
      }
    }

    // Sort selected by score
    selected.sort((a, b) => b.score - a.score);

    // Generate suggestions for top missing connectors
    const topMissing = missing
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);

    for (const m of topMissing) {
      suggestions.push({
        connectorId: m.id,
        name: m.name,
        category: m.category,
        relevance: m.relevance,
        reason: `Recommended for ${classification.category} tasks`,
      });
    }

    // Cache suggestions
    await cache.set(`suggestions:${userId}`, suggestions, 3600, 'orchestrator');

    return {
      selected: selected.slice(0, 10),
      missing: topMissing,
      suggestions,
      connectedCount: connected.length,
      category: classification.category,
    };
  }

  /**
   * Score a connector for a task classification.
   */
  scoreConnector(connector, classification, connectedInfo) {
    let score = 0.5;

    // Category match
    if (connector.category === classification.category) {
      score += 0.3;
    }

    // Health status
    const health = getHealthStatus(connector.id);
    if (health.status === 'up') score += 0.2;
    else if (health.status === 'degraded') score += 0.1;

    // Rate limit availability
    if (checkRateLimit(connectedInfo.userId || 'default', connector.id, 10, 60000)) {
      score += 0.1;
    }

    return Math.round(score * 100) / 100;
  }

  /**
   * Score connector relevance for a task category (0-1).
   */
  scoreConnectorRelevance(connector, classification) {
    let relevance = 0.1;

    if (connector.category === classification.category) {
      relevance = 0.9;
    } else if (
      (classification.category === 'marketing' && ['social', 'messaging'].includes(connector.category)) ||
      (classification.category === 'ecommerce' && ['ecommerce', 'payment'].includes(connector.category)) ||
      (classification.category === 'analytics' && ['analytics', 'crm'].includes(connector.category))
    ) {
      relevance = 0.6;
    }

    return Math.round(relevance * 100) / 100;
  }

  /**
   * Execute an AI task with automatic model selection and fallback.
   */
  async executeAITask(userId, taskType, messages, options = {}) {
    const selection = await this.selectModel(userId, taskType, messages.map((m) => m.content).join(' '), options);

    try {
      const result = await aiModelRegistry.generateChatCompletion(messages, {
        provider: selection.providerId,
        model: selection.modelId,
        ...options,
        fallbackChain: selection.fallbackChain,
      });

      // Log success
      await this.logTaskHistory(userId, taskType, {
        modelId: selection.modelId,
        providerId: selection.providerId,
        status: 'success',
        duration: Date.now() - (options.startTime || Date.now()),
        cost: selection.estimatedCost,
      });

      return {
        ...result,
        orchestration: {
          selectedModel: selection.modelId,
          provider: selection.providerId,
          alternatives: selection.alternatives,
          estimatedCost: selection.estimatedCost,
        },
      };
    } catch (err) {
      logger.error(`AI task failed for user ${userId}: ${taskType}`, { error: err.message });

      await this.logTaskHistory(userId, taskType, {
        modelId: selection.modelId,
        providerId: selection.providerId,
        status: 'error',
        error: err.message,
      });

      // If fallback chain is available, try next model
      if (selection.fallbackChain.length > 1) {
        const nextModel = selection.fallbackChain[1];
        logger.info(`Trying fallback model: ${nextModel}`);
        return this.executeAITask(userId, taskType, messages, {
          ...options,
          model: nextModel,
          fallbackChain: selection.fallbackChain.slice(1),
        });
      }

      throw err;
    }
  }

  /**
   * Execute a connector task with automatic connector selection and fallback.
   */
  async executeConnectorTask(userId, taskType, operation, payload = {}) {
    const connectors = await this.selectConnectors(userId, taskType, [operation]);

    if (connectors.selected.length === 0) {
      const error = new Error(`No connected ${taskType} connectors available for operation: ${operation}. Connect a ${taskType} integration first.`);
      error.statusCode = 400;
      error.code = 'CONNECTOR_MISSING';
      throw error;
    }

    const selected = connectors.selected[0];
    const connector = getConnectorById(selected.id);

    try {
      const result = await connectorRequest(userId, selected.id, connector, operation, payload);

      await this.logTaskHistory(userId, `${taskType}:${operation}`, {
        connectorId: selected.id,
        status: 'success',
      });

      return {
        ...result,
        orchestration: {
          selectedConnector: selected.id,
          connectorName: selected.name,
          health: selected.health,
        },
      };
    } catch (err) {
      logger.error(`Connector task failed for user ${userId}: ${selected.id}/${operation}`, { error: err.message });

      await this.logTaskHistory(userId, `${taskType}:${operation}`, {
        connectorId: selected.id,
        status: 'error',
        error: err.message,
      });

      // If there are other connectors, try the next one
      if (connectors.selected.length > 1) {
        const nextConnector = connectors.selected[1];
        logger.info(`Trying fallback connector: ${nextConnector.id}`);
        return this.executeConnectorTask(userId, taskType, operation, payload);
      }

      // Queue for retry if all connectors failed
      await addJob(QueueNames.CONNECTOR_SYNC, `${taskType}:${operation}`, {
        userId,
        connectorId: selected.id,
        operation,
        payload,
      });

      throw err;
    }
  }

  /**
   * Execute a full campaign orchestration (AI + connectors combined).
   */
  async executeCampaignOrchestration(userId, campaignData) {
    const { taskType, content, connectorOperations = [] } = campaignData;

    const results = {
      ai: null,
      connectors: [],
      errors: [],
      notifications: [],
    };

    // Execute AI generation
    if (content) {
      try {
        results.ai = await this.executeAITask(userId, taskType, content);
      } catch (err) {
        results.errors.push({ type: 'ai', error: err.message });
      }
    }

    // Execute connector operations in parallel
    if (connectorOperations.length > 0) {
      const connectorPromises = connectorOperations.map(async (op) => {
        try {
          const result = await this.executeConnectorTask(userId, taskType, op.operation, op.payload);
          results.connectors.push({ operation: op.operation, success: true, result });
        } catch (err) {
          results.errors.push({ type: 'connector', operation: op.operation, error: err.message });
          results.connectors.push({ operation: op.operation, success: false, error: err.message });
        }
      });

      await Promise.allSettled(connectorPromises);
    }

    // Send notification
    if (results.errors.length > 0) {
      sendNotification(userId, null, {
        type: 'warning',
        title: 'Campaign execution had issues',
        message: `${results.errors.length} operation(s) failed. Check the details.`,
      });
    } else {
      sendNotification(userId, null, {
        type: 'success',
        title: 'Campaign executed successfully',
        message: `AI + ${results.connectors.length} connector operations completed.`,
      });
    }

    return results;
  }

  /**
   * Get suggestions for new connectors a user should connect.
   */
  async getConnectorSuggestions(userId) {
    const cached = await cache.get(`suggestions:${userId}`, 'orchestrator');
    if (cached) return cached;

    const profile = await this.getUserProfile(userId);
    if (!profile) return [];

    const connectedIds = profile.connectedConnectors.map((c) => c.id);
    const suggestions = [];

    // Based on industry
    const industryConnectors = {
      'ecommerce': ['shopify', 'woocommerce', 'meta_facebook', 'google_ads', 'mailchimp', 'google_analytics'],
      'saas': ['hubspot', 'salesforce', 'intercom', 'slack', 'google_ads', 'meta_ads', 'segment'],
      'agency': ['meta_facebook', 'google_ads', 'linkedin', 'hubspot', 'mailchimp', 'google_analytics', 'semrush'],
      'healthcare': ['hubspot', 'zendesk', 'google_ads', 'meta_ads'],
      'finance': ['salesforce', 'hubspot', 'google_ads', 'linkedin', 'zendesk'],
      'education': ['meta_facebook', 'youtube', 'mailchimp', 'google_analytics', 'hubspot'],
      'nonprofit': ['meta_facebook', 'mailchimp', 'google_ads', 'google_analytics'],
      'restaurant': ['yelp', 'google_reviews', 'meta_facebook', 'google_ads', 'tripadvisor'],
      'real_estate': ['meta_facebook', 'google_ads', 'linkedin', 'hubspot', 'mailchimp'],
      'travel': ['tripadvisor', 'booking_com', 'meta_facebook', 'google_ads', 'airbnb'],
    };

    const industryRecs = industryConnectors[profile.industry] || CONNECTOR_RECOMMENDATIONS['default'];

    for (const connectorId of industryRecs) {
      if (!connectedIds.includes(connectorId)) {
        const connector = getConnectorById(connectorId);
        if (connector) {
          suggestions.push({
            connectorId,
            name: connector.name,
            category: connector.category,
            relevance: 0.85,
            reason: `Recommended for ${profile.industry} businesses`,
          });
        }
      }
    }

    await cache.set(`suggestions:${userId}`, suggestions, 3600, 'orchestrator');
    return suggestions;
  }

  /**
   * Log task execution history for learning.
   */
  async logTaskHistory(userId, taskType, data) {
    const history = this.taskHistory.get(userId) || [];
    history.push({
      taskType,
      ...data,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 1000 entries per user
    if (history.length > 1000) {
      history.shift();
    }

    this.taskHistory.set(userId, history);
    await cache.set(`task-history:${userId}`, history, 86400, 'orchestrator');
  }

  /**
   * Get task execution history for a user.
   */
  async getTaskHistory(userId, limit = 50) {
    const history = this.taskHistory.get(userId) || [];
    return history.slice(-limit);
  }

  /**
   * Get performance metrics for a user's AI usage.
   */
  async getPerformanceMetrics(userId) {
    const history = await this.getTaskHistory(userId, 1000);
    const aiTasks = history.filter((h) => h.modelId);
    const connectorTasks = history.filter((h) => h.connectorId);

    const totalCost = aiTasks.reduce((sum, h) => sum + (h.cost || 0), 0);
    const successRate = aiTasks.length > 0 ? (aiTasks.filter((h) => h.status === 'success').length / aiTasks.length) : 0;
    const avgDuration = aiTasks.length > 0 ? (aiTasks.reduce((sum, h) => sum + (h.duration || 0), 0) / aiTasks.length) : 0;

    const modelUsage = {};
    for (const task of aiTasks) {
      modelUsage[task.modelId] = (modelUsage[task.modelId] || 0) + 1;
    }

    const connectorUsage = {};
    for (const task of connectorTasks) {
      connectorUsage[task.connectorId] = (connectorUsage[task.connectorId] || 0) + 1;
    }

    return {
      totalTasks: history.length,
      aiTasks: aiTasks.length,
      connectorTasks: connectorTasks.length,
      totalCost: Math.round(totalCost * 1000) / 1000,
      successRate: Math.round(successRate * 100),
      avgDuration: Math.round(avgDuration),
      modelUsage,
      connectorUsage,
      topModels: Object.entries(modelUsage).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topConnectors: Object.entries(connectorUsage).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }

  /**
   * Optimize AI model selection based on historical performance.
   */
  async optimizeModelSelection(userId) {
    const metrics = await this.getPerformanceMetrics(userId);
    const profile = await this.getUserProfile(userId);

    // If success rate is low with current models, suggest alternatives
    if (metrics.successRate < 70) {
      const suggestions = [];
      const allModels = aiModelRegistry.getAllModels();
      const availableModels = allModels.filter((m) => {
        const provider = aiModelRegistry.getProvider(m.providerId);
        return provider?.isAvailable();
      });

      // Suggest models with better reliability
      for (const model of availableModels) {
        if (!metrics.topModels.find((m) => m[0] === model.id)) {
          suggestions.push({
            modelId: model.id,
            name: model.name,
            provider: model.providerId,
            reason: 'Not tried yet - may improve reliability',
            quality: model.quality,
            speed: model.speed,
          });
        }
      }

      return {
        currentSuccessRate: metrics.successRate,
        suggestions: suggestions.slice(0, 5),
        recommendation: 'Consider switching to more reliable models or adding fallback providers.',
      };
    }

    // If cost is high, suggest cheaper alternatives
    if (metrics.totalCost > 10) {
      const cheaperModels = aiModelRegistry.getAllModels()
        .filter((m) => {
          const provider = aiModelRegistry.getProvider(m.providerId);
          return provider?.isAvailable() && (m.cost || 0) > 0.8;
        })
        .sort((a, b) => (b.cost || 0) - (a.cost || 0))
        .slice(0, 5);

      return {
        currentCost: metrics.totalCost,
        suggestions: cheaperModels.map((m) => ({
          modelId: m.id,
          name: m.name,
          provider: m.providerId,
          reason: 'More cost-effective alternative',
          estimatedSavings: Math.round((1 - (m.cost || 0.5)) * 100) + '%',
        })),
        recommendation: 'Switch to more cost-effective models for non-critical tasks.',
      };
    }

    return {
      currentSuccessRate: metrics.successRate,
      currentCost: metrics.totalCost,
      suggestions: [],
      recommendation: 'Current model selection is performing well.',
    };
  }
}

export const intelligentOrchestrator = new IntelligentOrchestrator();
export default intelligentOrchestrator;

