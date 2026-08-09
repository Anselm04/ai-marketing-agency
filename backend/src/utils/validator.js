/**
 * Zod Request Validation Schemas
 * Replaces hand-rolled validation with type-safe, auto-documented schemas.
 */

import { z } from 'zod';

// ------------------------------------------------------------------
// Shared primitives
// ------------------------------------------------------------------

export const emailSchema = z.string().email().min(5).max(255);
export const passwordSchema = z.string().min(8).max(128);
export const idSchema = z.string().min(1).max(128);
export const uuidSchema = z.string().uuid().optional();
export const dateStringSchema = z.string().datetime().optional();
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1').transform((v) => parseInt(v, 10)),
  limit: z.string().regex(/^\d+$/).optional().default('20').transform((v) => Math.min(parseInt(v, 10), 100)),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ------------------------------------------------------------------
// Auth schemas
// ------------------------------------------------------------------

export const registerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
  organizationName: z.string().min(1).max(200).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
  confirmPassword: z.string().min(1),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ------------------------------------------------------------------
// Campaign schemas
// ------------------------------------------------------------------

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional().default('draft'),
  budget: z.number().min(0).max(100000000).optional(),
  currency: z.string().length(3).optional().default('USD'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  platforms: z.array(z.string().min(1).max(50)).optional().default([]),
  targetAudience: z.object({
    ageRange: z.string().optional(),
    gender: z.string().optional(),
    interests: z.array(z.string()).optional(),
    location: z.string().optional(),
  }).optional(),
  goals: z.array(z.string()).optional().default([]),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const campaignStrategySchema = z.object({
  product: z.string().min(1).max(500),
  budget: z.number().min(0).optional(),
  platforms: z.array(z.string()).optional().default([]),
  targetAudience: z.string().optional(),
  tone: z.enum(['professional', 'casual', 'humorous', 'urgent', 'empathetic']).optional().default('professional'),
  model: z.string().optional(),
});

// ------------------------------------------------------------------
// Content schemas
// ------------------------------------------------------------------

export const generateContentSchema = z.object({
  type: z.enum(['blog', 'social', 'email', 'ad', 'script', 'landing', 'product', 'seo']),
  platform: z.string().optional(),
  topic: z.string().min(1).max(500),
  keywords: z.array(z.string()).optional().default([]),
  tone: z.string().optional().default('professional'),
  length: z.enum(['short', 'medium', 'long']).optional().default('medium'),
  audience: z.string().optional(),
  model: z.string().optional(),
});

export const bulkGenerateContentSchema = z.object({
  items: z.array(generateContentSchema).min(1).max(50),
  campaignId: idSchema.optional(),
});

// ------------------------------------------------------------------
// CRM / Lead schemas
// ------------------------------------------------------------------

export const createLeadSchema = z.object({
  name: z.string().min(1).max(200),
  email: emailSchema.optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  source: z.string().max(100).optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).optional().default('new'),
  value: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional().default([]),
});

export const updateLeadSchema = createLeadSchema.partial();

// ------------------------------------------------------------------
// Social publish schemas
// ------------------------------------------------------------------

export const socialPublishSchema = z.object({
  platform: z.string().min(1).max(50),
  content: z.string().min(1).max(5000),
  hashtags: z.array(z.string()).optional().default([]),
  mediaUrls: z.array(z.string().url()).optional().default([]),
  scheduledAt: z.string().datetime().optional(),
  campaignId: idSchema.optional(),
});

// ------------------------------------------------------------------
// Video studio schemas
// ------------------------------------------------------------------

export const videoScriptSchema = z.object({
  product: z.string().min(1).max(500),
  audience: z.string().optional(),
  duration: z.number().min(15).max(300).optional().default(60),
  tone: z.string().optional().default('professional'),
  goal: z.string().optional(),
  model: z.string().optional(),
});

export const videoStoryboardSchema = z.object({
  script: z.string().min(1).max(10000),
  sceneCount: z.number().min(3).max(20).optional().default(8),
  model: z.string().optional(),
});

// ------------------------------------------------------------------
// Translation schemas
// ------------------------------------------------------------------

export const translateSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLanguage: z.string().min(2).max(10),
  sourceLanguage: z.string().min(2).max(10).optional(),
  model: z.string().optional(),
});

export const translateMultipleSchema = z.object({
  texts: z.array(z.string().min(1)).min(1).max(100),
  targetLanguage: z.string().min(2).max(10),
  sourceLanguage: z.string().min(2).max(10).optional(),
  model: z.string().optional(),
});

// ------------------------------------------------------------------
// Settings / Profile schemas
// ------------------------------------------------------------------

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  company: z.string().max(200).optional(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  phone: z.string().max(50).optional(),
});

export const updateIntegrationsSchema = z.object({
  integrations: z.record(z.boolean()).optional(),
  apiKeys: z.record(z.string().max(500)).optional(),
}).strict();

// ------------------------------------------------------------------
// Team / Org schemas
// ------------------------------------------------------------------

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['admin', 'member', 'viewer']).optional().default('member'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

// ------------------------------------------------------------------
// Legal / Document schemas
// ------------------------------------------------------------------

export const generateLegalDocSchema = z.object({
  type: z.enum(['terms', 'privacy', 'gdpr', 'ccpa', 'dmca', 'cookies', 'disclaimer', 'refund', 'affiliate', 'nda']),
  businessName: z.string().min(1).max(200),
  jurisdiction: z.string().max(100).optional(),
  websiteUrl: z.string().url().optional(),
  contactEmail: emailSchema.optional(),
  model: z.string().optional(),
});

// ------------------------------------------------------------------
// AI / Connector model selection schemas
// ------------------------------------------------------------------

export const aiModelPreferenceSchema = z.object({
  defaultProvider: z.string().optional(),
  defaultModel: z.string().optional(),
  costOptimization: z.boolean().optional().default(true),
  qualityThreshold: z.number().min(0).max(1).optional().default(0.7),
  fallbackChain: z.array(z.string()).optional().default([]),
});

export const connectorConfigSchema = z.object({
  connectorId: z.string().min(1).max(100),
  enabled: z.boolean(),
  settings: z.record(z.any()).optional(),
});

// ------------------------------------------------------------------
// Export schemas
// ------------------------------------------------------------------

export const exportSchema = z.object({
  type: z.enum(['leads', 'campaigns', 'content', 'analytics', 'full']),
  format: z.enum(['json', 'csv']).optional().default('json'),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  campaignId: idSchema.optional(),
});

// ------------------------------------------------------------------
// Middleware factory
// ------------------------------------------------------------------

/**
 * Express middleware factory that validates request body against a Zod schema.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Express middleware factory that validates request query params against a Zod schema.
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        message: 'Query validation failed',
        errors,
      });
    }
    req.query = result.data;
    next();
  };
}

/**
 * Express middleware factory that validates request params against a Zod schema.
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        message: 'Params validation failed',
        errors,
      });
    }
    req.params = result.data;
    next();
  };
}

/**
 * Standalone validation helper (non-middleware).
 */
export function validateRequest(data, schema) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

export default {
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  paginationSchema,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createCampaignSchema,
  updateCampaignSchema,
  campaignStrategySchema,
  generateContentSchema,
  bulkGenerateContentSchema,
  createLeadSchema,
  updateLeadSchema,
  socialPublishSchema,
  videoScriptSchema,
  videoStoryboardSchema,
  translateSchema,
  translateMultipleSchema,
  updateProfileSchema,
  updateIntegrationsSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  generateLegalDocSchema,
  aiModelPreferenceSchema,
  connectorConfigSchema,
  exportSchema,
};
