import axios from 'axios'
import { AIProvider, AIProviderError } from '../AIProvider.js'
import logger from '../../../utils/logger.js'

class CohereProvider extends AIProvider {
  constructor() {
    super('cohere')
    this.client = null
    if (process.env.COHERE_API_KEY) {
      this.client = axios.create({
        baseURL: 'https://api.cohere.com/v2',
        headers: { Authorization: `Bearer ${process.env.COHERE_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      })
    }
  }

  _checkAvailability() {
    return !!this.client
  }

  async chat(messages, options = {}) {
    if (!this.client) throw new AIProviderError('Cohere not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'command-r'
      const chatMessages = Array.isArray(messages)
        ? messages
        : [{ role: 'user', content: messages }]

      const response = await this.client.post('/chat', {
        model,
        messages: chatMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 4096,
      })

      return {
        content: response.data.message?.content?.[0]?.text || response.data.text,
        usage: response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model: response.data.model || model,
      }
    } catch (err) {
      this._handleError(err, 'chat')
    }
  }

  async embeddings(texts, options = {}) {
    if (!this.client) throw new AIProviderError('Cohere not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'embed-english-v3'
      const input = Array.isArray(texts) ? texts : [texts]
      const response = await this.client.post('/embed', {
        model,
        texts: input,
        input_type: 'search_document',
      })

      return {
        embeddings: response.data.embeddings || [],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }
    } catch (err) {
      this._handleError(err, 'embeddings')
    }
  }

  async vision(image, prompt, options = {}) {
    throw new AIProviderError('Cohere does not support vision', this.name, 'NOT_SUPPORTED')
  }

  async textToImage(prompt, options = {}) {
    throw new AIProviderError('Cohere does not support image generation', this.name, 'NOT_SUPPORTED')
  }

  async listModels() {
    return ['command-r-plus', 'command-r', 'command', 'embed-english-v3']
  }
}

export default new CohereProvider()
