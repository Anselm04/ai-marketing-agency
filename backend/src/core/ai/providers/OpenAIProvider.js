import OpenAI from 'openai'
import { AIProvider, AIProviderError } from '../AIProvider.js'
import logger from '../../../utils/logger.js'

class OpenAIProvider extends AIProvider {
  constructor() {
    super('openai')
    this.client = null
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    }
  }

  _checkAvailability() {
    return !!this.client
  }

  async chat(messages, options = {}) {
    if (!this.client) throw new AIProviderError('OpenAI not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'gpt-4o-mini'
      const completion = await this.client.chat.completions.create({
        model,
        messages: Array.isArray(messages) ? messages : [{ role: 'user', content: messages }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 4096,
        response_format: options.jsonMode ? { type: 'json_object' } : undefined,
      })
      return {
        content: completion.choices[0].message.content,
        usage: completion.usage,
        model: completion.model,
      }
    } catch (err) {
      this._handleError(err, 'chat')
    }
  }

  async embeddings(texts, options = {}) {
    if (!this.client) throw new AIProviderError('OpenAI not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'text-embedding-3-small'
      const input = Array.isArray(texts) ? texts : [texts]
      const response = await this.client.embeddings.create({ model, input })
      return {
        embeddings: response.data.map(d => d.embedding),
        usage: response.usage,
      }
    } catch (err) {
      this._handleError(err, 'embeddings')
    }
  }

  async vision(image, prompt, options = {}) {
    if (!this.client) throw new AIProviderError('OpenAI not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'gpt-4o'
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } },
          ],
        },
      ]
      const completion = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: options.maxTokens || 4096,
      })
      return {
        content: completion.choices[0].message.content,
        usage: completion.usage,
      }
    } catch (err) {
      this._handleError(err, 'vision')
    }
  }

  async textToImage(prompt, options = {}) {
    if (!this.client) throw new AIProviderError('OpenAI not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'dall-e-3'
      const response = await this.client.images.generate({
        model,
        prompt,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        n: 1,
      })
      return {
        url: response.data[0].url,
        revisedPrompt: response.data[0].revised_prompt,
      }
    } catch (err) {
      this._handleError(err, 'textToImage')
    }
  }

  async listModels() {
    if (!this.client) return []
    try {
      const models = await this.client.models.list()
      return models.data.map(m => m.id)
    } catch (err) {
      logger.warn('OpenAI listModels failed', { error: err.message })
      return []
    }
  }
}

export default new OpenAIProvider()
