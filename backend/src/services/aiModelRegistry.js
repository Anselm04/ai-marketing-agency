/**
 * AI Model Registry Service
 * Provides a unified interface across all AI providers with auto-discovery,
 * cost estimation, fallback chains, and streaming support.
 *
 * Supported providers: OpenAI, Anthropic, Google, Cohere, Mistral, Groq,
 * Azure OpenAI, AWS Bedrock, Ollama (local).
 */

import OpenAI from 'openai';
import axios from 'axios';
import { logger, logAIRequest } from '../utils/logger.js';
import { cache } from '../utils/cache.js';
import { recordAIRequest } from '../utils/metrics.js';

// ------------------------------------------------------------------
// Provider configurations
// ------------------------------------------------------------------

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    className: 'OpenAIProvider',
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    models: {
      'gpt-4o': { name: 'GPT-4o', quality: 0.95, speed: 0.85, cost: 0.85, context: 128000, vision: true, inputPrice: 5.0, outputPrice: 15.0 },
      'gpt-4o-mini': { name: 'GPT-4o Mini', quality: 0.82, speed: 0.95, cost: 0.95, context: 128000, vision: true, inputPrice: 0.15, outputPrice: 0.6 },
      'gpt-4-turbo': { name: 'GPT-4 Turbo', quality: 0.93, speed: 0.75, cost: 0.70, context: 128000, vision: true, inputPrice: 10.0, outputPrice: 30.0 },
      'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', quality: 0.70, speed: 0.98, cost: 0.98, context: 16385, vision: false, inputPrice: 0.5, outputPrice: 1.5 },
      'dall-e-3': { name: 'DALL-E 3', quality: 0.90, speed: 0.60, cost: 0.75, context: 0, vision: false, imagePrice: 0.04 },
      'whisper-1': { name: 'Whisper', quality: 0.85, speed: 0.80, cost: 0.90, context: 0, vision: false, audioPrice: 0.006 },
      'text-embedding-3-small': { name: 'Embedding Small', quality: 0.75, speed: 0.95, cost: 0.95, context: 8191, vision: false, inputPrice: 0.02 },
      'text-embedding-3-large': { name: 'Embedding Large', quality: 0.88, speed: 0.85, cost: 0.80, context: 8191, vision: false, inputPrice: 0.13 },
    },
  },
  anthropic: {
    name: 'Anthropic',
    className: 'AnthropicProvider',
    envKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com/v1',
    models: {
      'claude-3-5-sonnet-20241022': { name: 'Claude 3.5 Sonnet', quality: 0.94, speed: 0.88, cost: 0.80, context: 200000, vision: true, inputPrice: 3.0, outputPrice: 15.0 },
      'claude-3-opus-20240229': { name: 'Claude 3 Opus', quality: 0.96, speed: 0.70, cost: 0.60, context: 200000, vision: true, inputPrice: 15.0, outputPrice: 75.0 },
      'claude-3-haiku-20240307': { name: 'Claude 3 Haiku', quality: 0.78, speed: 0.97, cost: 0.95, context: 200000, vision: true, inputPrice: 0.25, outputPrice: 1.25 },
    },
  },
  google: {
    name: 'Google AI',
    className: 'GoogleProvider',
    envKey: 'GOOGLE_AI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: {
      'gemini-1.5-pro-latest': { name: 'Gemini 1.5 Pro', quality: 0.92, speed: 0.82, cost: 0.75, context: 2000000, vision: true, inputPrice: 3.5, outputPrice: 10.5 },
      'gemini-1.5-flash-latest': { name: 'Gemini 1.5 Flash', quality: 0.80, speed: 0.95, cost: 0.95, context: 1000000, vision: true, inputPrice: 0.35, outputPrice: 1.05 },
    },
  },
  cohere: {
    name: 'Cohere',
    className: 'CohereProvider',
    envKey: 'COHERE_API_KEY',
    baseUrl: 'https://api.cohere.com/v1',
    models: {
      'command-r-plus': { name: 'Command R+', quality: 0.88, speed: 0.75, cost: 0.70, context: 128000, vision: false, inputPrice: 3.0, outputPrice: 15.0 },
      'command-r': { name: 'Command R', quality: 0.82, speed: 0.85, cost: 0.85, context: 128000, vision: false, inputPrice: 0.5, outputPrice: 1.5 },
      'command': { name: 'Command', quality: 0.75, speed: 0.90, cost: 0.90, context: 4096, vision: false, inputPrice: 1.0, outputPrice: 2.0 },
    },
  },
  mistral: {
    name: 'Mistral AI',
    className: 'MistralProvider',
    envKey: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1',
    models: {
      'mistral-large-latest': { name: 'Mistral Large', quality: 0.90, speed: 0.80, cost: 0.75, context: 128000, vision: false, inputPrice: 2.0, outputPrice: 6.0 },
      'mistral-medium-latest': { name: 'Mistral Medium', quality: 0.84, speed: 0.88, cost: 0.85, context: 32000, vision: false, inputPrice: 0.9, outputPrice: 2.7 },
      'mistral-small-latest': { name: 'Mistral Small', quality: 0.76, speed: 0.95, cost: 0.95, context: 32000, vision: false, inputPrice: 0.2, outputPrice: 0.6 },
    },
  },
  groq: {
    name: 'Groq',
    className: 'GroqProvider',
    envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: {
      'llama-3.1-70b-versatile': { name: 'Llama 3.1 70B', quality: 0.86, speed: 0.98, cost: 0.90, context: 128000, vision: false, inputPrice: 0.59, outputPrice: 0.79 },
      'llama-3.1-8b-instant': { name: 'Llama 3.1 8B', quality: 0.78, speed: 0.99, cost: 0.95, context: 128000, vision: false, inputPrice: 0.05, outputPrice: 0.08 },
      'mixtral-8x7b-32768': { name: 'Mixtral 8x7B', quality: 0.82, speed: 0.97, cost: 0.92, context: 32768, vision: false, inputPrice: 0.24, outputPrice: 0.24 },
    },
  },
  azure: {
    name: 'Azure OpenAI',
    className: 'AzureOpenAIProvider',
    envKey: 'AZURE_OPENAI_API_KEY',
    baseUrl: process.env.AZURE_OPENAI_ENDPOINT,
    models: {
      'gpt-4o': { name: 'Azure GPT-4o', quality: 0.95, speed: 0.85, cost: 0.85, context: 128000, vision: true, inputPrice: 5.0, outputPrice: 15.0 },
      'gpt-4': { name: 'Azure GPT-4', quality: 0.93, speed: 0.75, cost: 0.70, context: 8192, vision: false, inputPrice: 30.0, outputPrice: 60.0 },
      'gpt-35-turbo': { name: 'Azure GPT-3.5', quality: 0.70, speed: 0.98, cost: 0.98, context: 16385, vision: false, inputPrice: 0.5, outputPrice: 1.5 },
    },
  },
  bedrock: {
    name: 'AWS Bedrock',
    className: 'BedrockProvider',
    envKey: 'AWS_BEDROCK_ACCESS_KEY',
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    models: {
      'anthropic.claude-3-5-sonnet-20241022-v2:0': { name: 'Bedrock Claude 3.5', quality: 0.94, speed: 0.88, cost: 0.80, context: 200000, vision: true, inputPrice: 3.0, outputPrice: 15.0 },
      'anthropic.claude-3-haiku-20240307-v1:0': { name: 'Bedrock Claude Haiku', quality: 0.78, speed: 0.97, cost: 0.95, context: 200000, vision: true, inputPrice: 0.25, outputPrice: 1.25 },
      'meta.llama3-1-70b-instruct-v1:0': { name: 'Bedrock Llama 3.1', quality: 0.86, speed: 0.90, cost: 0.90, context: 128000, vision: false, inputPrice: 0.72, outputPrice: 0.72 },
      'amazon.titan-text-express-v1': { name: 'Bedrock Titan', quality: 0.75, speed: 0.92, cost: 0.92, context: 8192, vision: false, inputPrice: 0.2, outputPrice: 0.6 },
    },
  },
  ollama: {
    name: 'Ollama (Local)',
    className: 'OllamaProvider',
    envKey: 'OLLAMA_BASE_URL',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    models: {
      'llama3.1': { name: 'Ollama Llama 3.1', quality: 0.80, speed: 0.85, cost: 1.0, context: 128000, vision: false, inputPrice: 0, outputPrice: 0 },
      'mistral': { name: 'Ollama Mistral', quality: 0.78, speed: 0.88, cost: 1.0, context: 32000, vision: false, inputPrice: 0, outputPrice: 0 },
      'codellama': { name: 'Ollama CodeLlama', quality: 0.75, speed: 0.85, cost: 1.0, context: 16000, vision: false, inputPrice: 0, outputPrice: 0 },
    },
  },
};

// ------------------------------------------------------------------
// Base Provider Class
// ------------------------------------------------------------------

class BaseProvider {
  constructor(config) {
    this.config = config;
    this.key = config.envKey ? (process.env[config.envKey] || '') : '';
    this.available = !!this.key;
  }

  isAvailable() {
    return this.available;
  }

  getModelInfo(modelId) {
    return this.config.models[modelId] || null;
  }

  getAllModels() {
    return Object.entries(this.config.models).map(([id, info]) => ({ id, ...info, provider: this.config.name }));
  }

  // Estimates cost in USD (per 1K tokens, approximate)
  estimateCost(modelId, inputTokens = 1000, outputTokens = 1000) {
    const model = this.getModelInfo(modelId);
    if (!model) return null;
    const inputCost = (model.inputPrice || 0) * (inputTokens / 1000);
    const outputCost = (model.outputPrice || 0) * (outputTokens / 1000);
    return inputCost + outputCost;
  }

  async generateChatCompletion(messages, options = {}) {
    throw new Error('Not implemented');
  }

  async generateCompletion(prompt, options = {}) {
    throw new Error('Not implemented');
  }

  async streamChatCompletion(messages, options = {}) {
    throw new Error('Not implemented');
  }

  async generateEmbedding(text, options = {}) {
    throw new Error('Not implemented');
  }
}

// ------------------------------------------------------------------
// OpenAI Provider
// ------------------------------------------------------------------

class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    if (this.available) {
      this.client = new OpenAI({ apiKey: this.key });
    }
  }

  async generateChatCompletion(messages, options = {}) {
    const model = options.model || 'gpt-4o-mini';
    const start = Date.now();
    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        top_p: options.topP ?? 1,
        presence_penalty: options.presencePenalty ?? 0,
        frequency_penalty: options.frequencyPenalty ?? 0,
        response_format: options.responseFormat ? { type: options.responseFormat } : undefined,
        stream: false,
      });
      const duration = Date.now() - start;
      const usage = response.usage || {};
      logAIRequest('openai', model, 'chat.completion', duration, usage.total_tokens, this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens));
      recordAIRequest('openai', model, 'chat.completion', duration, 'success', usage.total_tokens, this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens));
      return {
        content: response.choices[0]?.message?.content || '',
        usage,
        model: response.model,
        finishReason: response.choices[0]?.finish_reason,
      };
    } catch (err) {
      const duration = Date.now() - start;
      logAIRequest('openai', model, 'chat.completion', duration, null, null, 'error', err);
      recordAIRequest('openai', model, 'chat.completion', duration, 'error');
      throw err;
    }
  }

  async generateCompletion(prompt, options = {}) {
    return this.generateChatCompletion([{ role: 'user', content: prompt }], options);
  }

  async streamChatCompletion(messages, options = {}) {
    const model = options.model || 'gpt-4o-mini';
    return this.client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    });
  }

  async generateEmbedding(text, options = {}) {
    const model = options.model || 'text-embedding-3-small';
    const start = Date.now();
    const response = await this.client.embeddings.create({
      model,
      input: Array.isArray(text) ? text : [text],
    });
    const duration = Date.now() - start;
    logAIRequest('openai', model, 'embeddings', duration, response.usage?.total_tokens);
    return {
      embeddings: response.data.map((d) => d.embedding),
      model: response.model,
    };
  }
}

// ------------------------------------------------------------------
// Anthropic Provider
// ------------------------------------------------------------------

class AnthropicProvider extends BaseProvider {
  constructor(config) {
    super(config);
  }

  async generateChatCompletion(messages, options = {}) {
    const model = options.model || 'claude-3-5-sonnet-20241022';
    const start = Date.now();
    try {
      const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
      const userMessages = messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
      const response = await axios.post(
        `${this.config.baseUrl}/messages`,
        {
          model,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
          system: systemMessage || undefined,
          messages: userMessages,
        },
        {
          headers: {
            'x-api-key': this.key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 60000,
        }
      );
      const duration = Date.now() - start;
      const usage = response.data.usage || {};
      logAIRequest('anthropic', model, 'chat.completion', duration, usage.input_tokens + usage.output_tokens, this.estimateCost(model, usage.input_tokens, usage.output_tokens));
      recordAIRequest('anthropic', model, 'chat.completion', duration, 'success', usage.input_tokens + usage.output_tokens, this.estimateCost(model, usage.input_tokens, usage.output_tokens));
      return {
        content: response.data.content?.[0]?.text || '',
        usage: { prompt_tokens: usage.input_tokens, completion_tokens: usage.output_tokens, total_tokens: usage.input_tokens + usage.output_tokens },
        model: response.data.model,
        finishReason: response.data.stop_reason,
      };
    } catch (err) {
      const duration = Date.now() - start;
      logAIRequest('anthropic', model, 'chat.completion', duration, null, null, 'error', err);
      recordAIRequest('anthropic', model, 'chat.completion', duration, 'error');
      throw err;
    }
  }

  async generateCompletion(prompt, options = {}) {
    return this.generateChatCompletion([{ role: 'user', content: prompt }], options);
  }

  async streamChatCompletion(messages, options = {}) {
    // Return a mock stream for now — full streaming implementation requires SSE handling
    const response = await this.generateChatCompletion(messages, options);
    return {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: response.content } }] };
      },
    };
  }
}

// ------------------------------------------------------------------
// Google Provider
// ------------------------------------------------------------------

class GoogleProvider extends BaseProvider {
  async generateChatCompletion(messages, options = {}) {
    const model = options.model || 'gemini-1.5-flash-latest';
    const start = Date.now();
    try {
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const response = await axios.post(
        `${this.config.baseUrl}/models/${model}:generateContent?key=${this.key}`,
        {
          contents,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens || 4096,
            topP: options.topP ?? 1,
          },
        },
        { timeout: 60000 }
      );
      const duration = Date.now() - start;
      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      logAIRequest('google', model, 'chat.completion', duration, null, this.estimateCost(model, 1000, 1000));
      recordAIRequest('google', model, 'chat.completion', duration, 'success');
      return {
        content: text,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model,
        finishReason: response.data.candidates?.[0]?.finishReason,
      };
    } catch (err) {
      const duration = Date.now() - start;
      logAIRequest('google', model, 'chat.completion', duration, null, null, 'error', err);
      recordAIRequest('google', model, 'chat.completion', duration, 'error');
      throw err;
    }
  }

  async generateCompletion(prompt, options = {}) {
    return this.generateChatCompletion([{ role: 'user', content: prompt }], options);
  }
}

// ------------------------------------------------------------------
// Cohere Provider
// ------------------------------------------------------------------

class CohereProvider extends BaseProvider {
  async generateChatCompletion(messages, options = {}) {
    const model = options.model || 'command-r';
    const start = Date.now();
    try {
      const message = messages[messages.length - 1]?.content || '';
      const chatHistory = messages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
        message: m.content,
      }));
      const response = await axios.post(
        `${this.config.baseUrl}/chat`,
        {
          model,
          message,
          chat_history: chatHistory,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || 4096,
        },
        {
          headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );
      const duration = Date.now() - start;
      logAIRequest('cohere', model, 'chat.completion', duration, null, this.estimateCost(model, 1000, 1000));
      recordAIRequest('cohere', model, 'chat.completion', duration, 'success');
      return {
        content: response.data.text || '',
        usage: response.data.meta?.billed_units || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model,
      };
    } catch (err) {
      const duration = Date.now() - start;
      logAIRequest('cohere', model, 'chat.completion', duration, null, null, 'error', err);
      recordAIRequest('cohere', model, 'chat.completion', duration, 'error');
      throw err;
    }
  }

  async generateCompletion(prompt, options = {}) {
    return this.generateChatCompletion([{ role: 'user', content: prompt }], options);
  }
}

// ------------------------------------------------------------------
// Mistral Provider
// ------------------------------------------------------------------

class MistralProvider extends BaseProvider {
  async generateChatCompletion(messages, options = {}) {
    const model = options.model || 'mistral-medium-latest';
    const start = Date.now();
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/chat/completions`,
        {
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || 4096,
        },
        {
          headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );
      const duration = Date.now() - start;
      const usage = response.data.usage || {};
      logAIRequest('mistral', model, 'chat.completion', duration, usage.total_tokens, this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens));
      recordAIRequest('mistral', model, 'chat.completion', duration, 'success', usage.total_tokens, this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens));
      return {
        content: response.data.choices?.[0]?.message?.content || '',
        usage,
        model: response.data.model,
        finishReason: response.data.choices?.[0]?.finish_reason,
      };
    } catch (err) {
      const duration = Date.now() - start;
      logAIRequest('mistral', model, 'chat.completion', duration, null, null, 'error', err);
      recordAIRequest('mistral', model, 'chat.completion', duration, 'error');
      throw err;
    }
  }

  async generateCompletion(prompt, options = {}) {
    return this.generateChatCompletion([{ role: 'user', content: prompt }], options);
  }
}

// ------------------------------------------------------------------
// Groq Provider
// ------------------------------------------------------------------

class GroqProvider extends BaseProvider {
  async generateChatCompletion(messages, options = {}) {
    const model = options.model || 'llama-3.1-70b-versatile';
    const start = Date.now();
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/chat/completions`,
        {
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || 4096,
        },
        {
          headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );
      const duration = Date.now() - start;
      const usage = response.data.usage || {};
      logAIRequest('groq', model, 'chat.completion', duration, usage.total_tokens, this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens));
      recordAIRequest('groq', model, 'chat.completion', duration, 'success', usage.total_tokens, this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens));
      return {
        content: response.data.choices?.[0]?.message?.content || '',
        usage,
        model: response.data.model,
        finishReason: response.data.choices?.[0]?.finish_reason,
      };
    } catch (err) {
      const duration = Date.now() - start;
      logAIRequest('groq', model, 'chat.completion', duration, null, null, 'error', err);
      recordAIRequest('groq', model, 'chat.completion', duration, 'error');
      throw err;
    }
  }

  async generateCompletion(prompt, options = {}) {
    return this.generateChatCompletion([{ role: 'user', content: prompt }], options);
  }
}

// ------------------------------------------------------------------
// Azure OpenAI Provider
// ------------------------------------------------------------------

class AzureOpenAIProvider extends BaseProvider {
  async generateChatCompletion(messages, options = {}) {
    const model = options.model || 'gpt-4o';
    const start = Date.now();
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/openai/deployments/${model}/chat/completions?api-version=2024-06-01`,
        {
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || 4096,
        },
        {
          headers: { 'api-key': this.key, 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );
      const duration = Date.now() - start;
      const usage = response.data.usage || {};
      logAIRequest('azure', model, 'chat.completion', duration, usage.total_tokens, this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens));
      recordAIRequest('azure', model, 'chat.completion', duration, 'success', usage.total_tokens, this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens));
      return {
        content: response.data.choices?.[0]?.message?.content || '',
        usage,
        model: response.data.model,
        finishReason: response.data.choices?.[0]?.finish_reason,
      };
    } catch (err) {
      const duration = Date.now() - start;
      logAIRequest('azure', model, 'chat.completion', duration, null, null, 'error', err);
      recordAIRequest('azure', model, 'chat.completion', duration, 'error');
      throw err;
    }
  }

  async generateCompletion(prompt, options = {}) {
    return this.generateChatCompletion([{ role: 'user', content: prompt }], options);
  }
}

// ------------------------------------------------------------------
// AWS Bedrock Provider
// ------------------------------------------------------------------

class BedrockProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.secretKey = process.env.AWS_BEDROCK_SECRET_KEY || '';
    this.region = process.env.AWS_BEDROCK_REGION || 'us-east-1';
  }

  async generateChatCompletion(messages, options = {}) {
    const model = options.model || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    const start = Date.now();
    try {
      // Using AWS SDK v3 would be better, but axios + SigV4 is complex.
      // For now, this is a simplified version using the invoke API.
      const response = await axios.post(
        `https://bedrock-runtime.${this.region}.amazonaws.com/model/${model}/invoke`,
        {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: options.maxTokens || 4096,
          messages: messages.map((m) => ({ role: m.role, content: [{ type: 'text', text: m.content }] })),
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          auth: {
            username: this.key,
            password: this.secretKey,
          },
          timeout: 60000,
        }
      );
      const duration = Date.now() - start;
      logAIRequest('bedrock', model, 'chat.completion', duration, null, this.estimateCost(model, 1000, 1000));
      recordAIRequest('bedrock', model, 'chat.completion', duration, 'success');
      return {
        content: response.data.content?.[0]?.text || '',
        usage: response.data.usage || {},
        model,
      };
    } catch (err) {
      const duration = Date.now() - start;
      logAIRequest('bedrock', model, 'chat.completion', duration, null, null, 'error', err);
      recordAIRequest('bedrock', model, 'chat.completion', duration, 'error');
      throw err;
    }
  }

  async generateCompletion(prompt, options = {}) {
    return this.generateChatCompletion([{ role: 'user', content: prompt }], options);
  }
}

// ------------------------------------------------------------------
// Ollama Provider (Local)
// ------------------------------------------------------------------

class OllamaProvider extends BaseProvider {
  async generateChatCompletion(messages, options = {}) {
    const model = options.model || 'llama3.1';
    const start = Date.now();
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/api/chat`,
        {
          model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens || 4096,
          },
        },
        { timeout: 120000 }
      );
      const duration = Date.now() - start;
      logAIRequest('ollama', model, 'chat.completion', duration, null, 0);
      recordAIRequest('ollama', model, 'chat.completion', duration, 'success', null, 0);
      return {
        content: response.data.message?.content || '',
        usage: {},
        model,
      };
    } catch (err) {
      const duration = Date.now() - start;
      logAIRequest('ollama', model, 'chat.completion', duration, null, null, 'error', err);
      recordAIRequest('ollama', model, 'chat.completion', duration, 'error');
      throw err;
    }
  }

  async generateCompletion(prompt, options = {}) {
    return this.generateChatCompletion([{ role: 'user', content: prompt }], options);
  }
}

// ------------------------------------------------------------------
// Registry Factory
// ------------------------------------------------------------------

let providerInstances = null;

function getProviderInstances() {
  if (!providerInstances) {
    providerInstances = {};
    const classMap = {
      OpenAIProvider,
      AnthropicProvider,
      GoogleProvider,
      CohereProvider,
      MistralProvider,
      GroqProvider,
      AzureOpenAIProvider,
      BedrockProvider,
      OllamaProvider,
    };
    for (const [key, config] of Object.entries(PROVIDERS)) {
      try {
        const ProviderClass = classMap[config.className];
        if (ProviderClass) {
          providerInstances[key] = new ProviderClass(config);
        } else {
          logger.warn(`Unknown provider class ${config.className} for ${key}`);
          providerInstances[key] = null;
        }
      } catch (err) {
        logger.warn(`Failed to initialize AI provider ${key}`, { error: err.message });
        providerInstances[key] = null;
      }
    }
  }
  return providerInstances;
}

// ------------------------------------------------------------------
// Registry API
// ------------------------------------------------------------------

export const aiModelRegistry = {
  /**
   * Get all available providers and their status.
   */
  getAllProviders() {
    const instances = getProviderInstances();
    return Object.entries(PROVIDERS).map(([key, config]) => ({
      id: key,
      name: config.name,
      available: instances[key]?.isAvailable() || false,
      models: instances[key]?.getAllModels() || [],
    }));
  },

  /**
   * Get all models across all providers.
   */
  getAllModels() {
    const instances = getProviderInstances();
    const allModels = [];
    for (const [key, config] of Object.entries(PROVIDERS)) {
      const provider = instances[key];
      if (!provider) continue;
      allModels.push(...provider.getAllModels().map((m) => ({ ...m, providerId: key, providerName: config.name })));
    }
    return allModels;
  },

  /**
   * Get a specific provider instance.
   */
  getProvider(providerId) {
    return getProviderInstances()[providerId] || null;
  },

  /**
   * Get default provider (configured or first available).
   */
  getDefaultProvider() {
    const defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'openai';
    const instances = getProviderInstances();
    if (instances[defaultProvider]?.isAvailable()) return instances[defaultProvider];
    for (const provider of Object.values(instances)) {
      if (provider?.isAvailable()) return provider;
    }
    return null;
  },

  /**
   * Check if a specific provider is available.
   */
  isProviderAvailable(providerId) {
    const provider = getProviderInstances()[providerId];
    return provider?.isAvailable() || false;
  },

  /**
   * Get model info across providers.
   */
  getModelInfo(modelId, providerId = null) {
    if (providerId) {
      const provider = getProviderInstances()[providerId];
      return provider?.getModelInfo(modelId) || null;
    }
    for (const provider of Object.values(getProviderInstances())) {
      if (!provider) continue;
      const info = provider.getModelInfo(modelId);
      if (info) return { ...info, providerId: Object.keys(PROVIDERS).find((k) => PROVIDERS[k].class === provider.constructor) };
    }
    return null;
  },

  /**
   * Generate chat completion with auto-fallback.
   */
  async generateChatCompletion(messages, options = {}) {
    const providerId = options.provider || process.env.DEFAULT_AI_PROVIDER || 'openai';
    const model = options.model || process.env.DEFAULT_CHAT_MODEL || 'gpt-4o-mini';
    const fallbackChain = options.fallbackChain || process.env.AI_FALLBACK_CHAIN?.split(',') || [];

    const providers = [providerId, ...fallbackChain].filter(Boolean);
    let lastError = null;

    for (const pid of providers) {
      const provider = getProviderInstances()[pid];
      if (!provider || !provider.isAvailable()) continue;
      try {
        const result = await provider.generateChatCompletion(messages, { ...options, model });
        return { ...result, provider: pid };
      } catch (err) {
        lastError = err;
        logger.warn(`AI provider ${pid} failed, trying next fallback`, { error: err.message });
      }
    }

    throw lastError || new Error('No AI providers available');
  },

  /**
   * Generate a simple completion with auto-fallback.
   */
  async generateCompletion(prompt, options = {}) {
    return this.generateChatCompletion([{ role: 'user', content: prompt }], options);
  },

  /**
   * Generate embeddings.
   */
  async generateEmbedding(text, options = {}) {
    const providerId = options.provider || 'openai';
    const provider = getProviderInstances()[providerId];
    if (!provider || !provider.isAvailable()) {
      throw new Error(`Provider ${providerId} not available for embeddings`);
    }
    return provider.generateEmbedding(text, options);
  },

  /**
   * Score a model for a specific task type.
   * Returns 0-1 composite score based on quality, speed, cost, and context fit.
   */
  scoreModel(modelId, providerId, taskType, options = {}) {
    const model = this.getModelInfo(modelId, providerId);
    if (!model) return 0;

    const taskWeights = {
      'chat': { quality: 0.4, speed: 0.3, cost: 0.2, context: 0.1 },
      'code': { quality: 0.5, speed: 0.2, cost: 0.1, context: 0.2 },
      'creative': { quality: 0.6, speed: 0.2, cost: 0.1, context: 0.1 },
      'legal': { quality: 0.7, speed: 0.1, cost: 0.1, context: 0.1 },
      'marketing': { quality: 0.4, speed: 0.3, cost: 0.2, context: 0.1 },
      'analysis': { quality: 0.5, speed: 0.2, cost: 0.1, context: 0.2 },
      'summary': { quality: 0.3, speed: 0.4, cost: 0.2, context: 0.1 },
      'translation': { quality: 0.5, speed: 0.3, cost: 0.1, context: 0.1 },
      'default': { quality: 0.4, speed: 0.3, cost: 0.2, context: 0.1 },
    };

    const weights = taskWeights[taskType] || taskWeights.default;
    const qualityScore = model.quality || 0.5;
    const speedScore = model.speed || 0.5;
    const costScore = model.cost || 0.5;
    const contextScore = options.requiredContext ? Math.min((model.context || 0) / options.requiredContext, 1) : 1;

    const composite =
      qualityScore * weights.quality +
      speedScore * weights.speed +
      costScore * weights.cost +
      contextScore * weights.context;

    return Math.round(composite * 100) / 100;
  },

  /**
   * Get the best model for a task, considering user preferences and cost optimization.
   */
  getBestModel(taskType, userPreferences = {}, options = {}) {
    const allModels = this.getAllModels();
    const availableModels = allModels.filter((m) => {
      const provider = getProviderInstances()[m.providerId];
      return provider?.isAvailable();
    });

    if (availableModels.length === 0) return null;

    let scored = availableModels.map((m) => ({
      ...m,
      score: this.scoreModel(m.id, m.providerId, taskType, options),
    }));

    if (userPreferences.costOptimization !== false) {
      const qualityThreshold = userPreferences.qualityThreshold || 0.7;
      scored = scored.filter((m) => m.score >= qualityThreshold);
    }

    scored.sort((a, b) => b.score - a.score);
    return scored[0] || null;
  },

  /**
   * Estimate cost for a request.
   */
  estimateCost(providerId, modelId, inputTokens, outputTokens) {
    const provider = getProviderInstances()[providerId];
    if (!provider) return null;
    return provider.estimateCost(modelId, inputTokens, outputTokens);
  },
};

export default aiModelRegistry;
