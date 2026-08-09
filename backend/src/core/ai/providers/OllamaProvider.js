import axios from 'axios'
import { AIProvider, AIProviderError } from '../AIProvider.js'
import logger from '../../../utils/logger.js'

class OllamaProvider extends AIProvider {
  constructor() {
    super('ollama')
    this.baseURL = process.env.OLLAMA_URL || 'http://localhost:11434'
    this.client = axios.create({ baseURL: this.baseURL, timeout: 60000 })
  }

  _checkAvailability() {
    return true // Ollama is always "available" but may fail at runtime
  }

  async chat(messages, options = {}) {
    try {
      const model = options.model || 'llama3.1'
      const chatMessages = Array.isArray(messages)
        ? messages
        : [{ role: 'user', content: messages }]

      const response = await this.client.post('/api/chat', {
        model,
        messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
        },
      })

      return {
        content: response.data.message?.content || response.data.response,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model,
      }
    } catch (err) {
      this._handleError(err, 'chat')
    }
  }

  async embeddings(texts, options = {}) {
    try {
      const model = options.model || 'nomic-embed-text'
      const input = Array.isArray(texts) ? texts : [texts]
      const embeddings = []

      for (const text of input) {
        const response = await this.client.post('/api/embeddings', {
          model,
          prompt: text,
        })
        embeddings.push(response.data.embedding)
      }

      return { embeddings, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
    } catch (err) {
      this._handleError(err, 'embeddings')
    }
  }

  async vision(image, prompt, options = {}) {
    try {
      const model = options.model || 'llava'
      const response = await this.client.post('/api/generate', {
        model,
        prompt,
        images: [image.replace(/^data:image\/\w+;base64,/, '')],
        stream: false,
      })

      return {
        content: response.data.response,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }
    } catch (err) {
      this._handleError(err, 'vision')
    }
  }

  async textToImage(prompt, options = {}) {
    throw new AIProviderError('Ollama does not support image generation natively', this.name, 'NOT_SUPPORTED')
  }

  async listModels() {
    try {
      const response = await this.client.get('/api/tags')
      return response.data.models?.map(m => m.name) || []
    } catch (err) {
      logger.warn('Ollama listModels failed', { error: err.message })
      return []
    }
  }
}

export default new OllamaProvider()
