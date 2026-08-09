import axios from 'axios'
import { AIProvider, AIProviderError } from '../AIProvider.js'
import logger from '../../../utils/logger.js'

class MistralProvider extends AIProvider {
  constructor() {
    super('mistral')
    this.client = null
    if (process.env.MISTRAL_API_KEY) {
      this.client = axios.create({
        baseURL: 'https://api.mistral.ai/v1',
        headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
        timeout: 30000,
      })
    }
  }

  _checkAvailability() {
    return !!this.client
  }

  async chat(messages, options = {}) {
    if (!this.client) throw new AIProviderError('Mistral not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'mistral-medium'
      const chatMessages = Array.isArray(messages)
        ? messages
        : [{ role: 'user', content: messages }]

      const response = await this.client.post('/chat/completions', {
        model,
        messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 4096,
      })

      return {
        content: response.data.choices[0].message.content,
        usage: response.data.usage,
        model: response.data.model,
      }
    } catch (err) {
      this._handleError(err, 'chat')
    }
  }

  async embeddings(texts, options = {}) {
    if (!this.client) throw new AIProviderError('Mistral not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'mistral-embed'
      const input = Array.isArray(texts) ? texts : [texts]
      const response = await this.client.post('/embeddings', {
        model,
        input,
      })

      return {
        embeddings: response.data.data.map(d => d.embedding),
        usage: response.data.usage,
      }
    } catch (err) {
      this._handleError(err, 'embeddings')
    }
  }

  async vision(image, prompt, options = {}) {
    if (!this.client) throw new AIProviderError('Mistral not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'pixtral-large-latest'
      const response = await this.client.post('/chat/completions', {
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } },
          ],
        }],
        max_tokens: options.maxTokens || 4096,
      })

      return {
        content: response.data.choices[0].message.content,
        usage: response.data.usage,
      }
    } catch (err) {
      this._handleError(err, 'vision')
    }
  }

  async textToImage(prompt, options = {}) {
    throw new AIProviderError('Mistral does not support image generation', this.name, 'NOT_SUPPORTED')
  }

  async listModels() {
    if (!this.client) return []
    try {
      const response = await this.client.get('/models')
      return response.data.data?.map(m => m.id) || []
    } catch (err) {
      logger.warn('Mistral listModels failed', { error: err.message })
      return []
    }
  }
}

export default new MistralProvider()
