import OpenAI from 'openai';
import dotenv from 'dotenv';
import { getCurrentUserId } from '../utils/requestContext.js';
import { assertMonthlyAiTokenQuota } from './planQuotaService.js';
import { recordAiUsage } from './usageMeteringService.js';

dotenv.config();

function resolveLlmClient() {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey !== 'no-key') {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      provider: 'openai',
      missingKey: null,
    };
  }
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      }),
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      provider: 'groq',
      missingKey: null,
    };
  }
  return {
    client: new OpenAI({ apiKey: 'no-key' }),
    model: 'gpt-4o-mini',
    provider: null,
    missingKey: 'OPENAI_API_KEY or GROQ_API_KEY',
  };
}

const resolved = resolveLlmClient();
const openai = resolved.client;
const DEFAULT_MODEL = resolved.model;
const DEFAULT_PROVIDER = resolved.provider;

export function openaiStatus() {
  const r = resolveLlmClient();
  const configured = !r.missingKey;
  return {
    openaiConfigured: configured,
    provider: r.provider,
    model: r.model,
    missingKey: r.missingKey,
    note: configured
      ? `LLM ready via ${r.provider} (${r.model}).`
      : 'No OPENAI_API_KEY or GROQ_API_KEY. Copy templates still generate. AI video/script needs a key.',
  };
}

function fallbackFromError(err, agentType, task) {
  const status = err?.status || err?.response?.status;
  const missing = !!resolveLlmClient().missingKey || status === 401;
  return {
    fallback: true,
    missingKey: missing ? (resolveLlmClient().missingKey || 'OPENAI_API_KEY') : null,
    openaiConfigured: !missing,
    error: err?.message || 'openai-unavailable',
    content: `[AI offline${missing ? ': missing OPENAI_API_KEY' : ''}] ${agentType} would: ${task}`,
  };
}

function estimatedRequestTokens(messages, maxOutputTokens) {
  const characters = messages.reduce((total, message) => total + String(message?.content || '').length, 0);
  return Math.max(1, Math.ceil(characters / 4) + Number(maxOutputTokens || 0));
}

async function enforceAiQuota(userId, messages, maxOutputTokens) {
  if (!userId) return;
  await assertMonthlyAiTokenQuota(userId, estimatedRequestTokens(messages, maxOutputTokens));
}

async function accountAiUsage(userId, operation, response) {
  if (!userId || !response?.usage) return;
  await recordAiUsage({
    userId,
    provider: DEFAULT_PROVIDER,
    model: response.model || DEFAULT_MODEL,
    operation,
    usage: response.usage,
  });
}

export async function generateAgentResponse(agentType, task, context = {}) {
  if (resolveLlmClient().missingKey) {
    return fallbackFromError({ status: 401, message: resolveLlmClient().missingKey }, agentType, task);
  }

  const systemPrompts = {
    'chief-strategy': 'You are a Chief Strategy Officer. You create high-level marketing strategies, budget allocations, and campaign priorities. Be concise and actionable.',
    'social-media': 'You are a Social Media Manager. You create engaging posts, captions, hashtags, and content calendars for TikTok, Instagram, X, LinkedIn, and Facebook.',
    'content': 'You are a Content Strategist. You write SEO-optimized articles, ad copy, landing page text, and video scripts.',
    'seo-aeo': 'You are an SEO/AEO Specialist. You optimize content for search engines and app store algorithms. Provide keyword lists and metadata suggestions.',
    'video': 'You are a Video Creative Director. You write video ad scripts, storyboards, and visual concepts for short-form and long-form content.',
    'legal-compliance': 'You are a Legal Compliance Officer. You review marketing content for advertising law, platform policies, GDPR, CCPA compliance. Flag issues.',
    'customer-service': 'You are a Customer Support Lead. You draft professional, helpful responses to customer inquiries and complaints.',
    'market-research': 'You are a Market Research Analyst. You summarize trends, competitor moves, and audience insights.',
    'performance-optimizer': 'You are a Growth Hacker. You suggest A/B tests, funnel optimizations, and conversion improvements.',
    'automation-coordinator': 'You are an Operations Coordinator. You create task sequences, assign priorities, and ensure agents work in sync.',
    'agent-oversight': 'You are an AI Oversight Manager. You review agent outputs for quality, accuracy, and alignment with brand voice.',
    'harmony-director': 'You are a Team Synergy Coach. You identify conflicts, overlaps, and inefficiencies in multi-agent workflows.',
  };

  const system = systemPrompts[agentType] || 'You are an AI marketing assistant. Be helpful and concise.';
  const { userId: explicitUserId, ...promptContext } = context || {};
  const userId = explicitUserId || getCurrentUserId();

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: `Task: ${task}\nContext: ${JSON.stringify(promptContext, null, 2)}\n\nRespond with a concise, actionable output.` },
  ];

  await enforceAiQuota(userId, messages, 800);

  let response;
  try {
    response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 800,
    });
  } catch (err) {
    console.error('OpenAI error:', err.message);
    return fallbackFromError(err, agentType, task);
  }

  await accountAiUsage(userId, 'agent-response', response);
  return {
    fallback: false,
    content: response.choices[0].message.content,
    tokens: response.usage,
  };
}

export async function generateCampaignStrategy(product, budget, platforms, targetAudience) {
  if (resolveLlmClient().missingKey) {
    return { fallback: true, missingKey: resolveLlmClient().missingKey, strategy: 'AI offline (OPENAI_API_KEY missing). Templates still generate.' };
  }

  const prompt = `Create a marketing campaign strategy for:\nProduct: ${product}\nBudget: $${budget}\nPlatforms: ${platforms.join(', ')}\nTarget Audience: ${targetAudience}\n\nReturn a structured JSON with:\n- campaignName\n- phases (array with name, duration, tactics)\n- budgetAllocation (object with platform percentages)\n- kpis (array of key metrics)\n- contentIdeas (array of 5 ideas)\n- risks (array of 3 risks and mitigations)`;
  const messages = [
    { role: 'system', content: 'You are a Chief Strategy Officer. Return valid JSON only.' },
    { role: 'user', content: prompt },
  ];
  const userId = getCurrentUserId();
  await enforceAiQuota(userId, messages, 4096);

  let response;
  try {
    response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });
  } catch (err) {
    console.error('OpenAI strategy error:', err.message);
    const missing = err?.status === 401 || err?.response?.status === 401;
    return { fallback: true, missingKey: missing ? (resolveLlmClient().missingKey || 'OPENAI_API_KEY') : null, strategy: { error: err.message } };
  }

  await accountAiUsage(userId, 'campaign-strategy', response);
  return {
    fallback: false,
    strategy: JSON.parse(response.choices[0].message.content),
    tokens: response.usage,
  };
}

export async function generateLegalDocument(type, businessName, jurisdiction) {
  if (resolveLlmClient().missingKey) {
    return { fallback: true, document: `[AI offline] ${type} template for ${businessName}.` };
  }

  const prompts = {
    terms: `Generate a Terms & Conditions document for ${businessName}. Include: acceptance, user conduct, intellectual property, limitation of liability, governing law (${jurisdiction}), and termination.`,
    privacy: `Generate a Privacy Policy for ${businessName}. Include: data collection, use, cookies, third parties, user rights, contact info. Comply with GDPR and CCPA where applicable.`,
    gdpr: `Generate a GDPR compliance checklist and data processing notice for ${businessName}.`,
    ccpa: `Generate a CCPA privacy notice for ${businessName}. Include: categories of personal information, rights to know/delete/opt-out, non-discrimination.`,
    dmca: `Generate a DMCA policy for ${businessName}. Include: takedown procedure, contact info, counter-notification, repeat infringer policy.`,
    cookie: `Generate a Cookie Policy for ${businessName}. Explain types of cookies used, purposes, and how to manage preferences.`,
  };
  const messages = [
    { role: 'system', content: 'You are a legal document generator. Produce clean, professional legal text. Add disclaimers that this is a template and should be reviewed by a lawyer.' },
    { role: 'user', content: prompts[type] || `Generate a ${type} legal document for ${businessName}.` },
  ];
  const userId = getCurrentUserId();
  await enforceAiQuota(userId, messages, 2000);

  let response;
  try {
    response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    });
  } catch (err) {
    console.error('OpenAI legal error:', err.message);
    return { fallback: true, document: `[AI error: ${err.message}] ${type} template for ${businessName}.` };
  }

  await accountAiUsage(userId, 'legal-document', response);
  return {
    fallback: false,
    document: response.choices[0].message.content,
    tokens: response.usage,
  };
}
