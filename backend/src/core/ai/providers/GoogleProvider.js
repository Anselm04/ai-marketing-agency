import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIProvider, AIProviderError } from '../AIProvider.js'
import logger from '../../../utils/logger.js'

class GoogleProvider extends AIProvider {
  constructor() {
    super('google')
    this.client = null
    if (process.env.GOOGLE_API_KEY) {
      this.client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    }
  }

  _checkAvailability() {
    return !!this.client
  }

  async chat(messages, options = {}) {
    if (!this.client) throw new AIProviderError('Google AI not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'gemini-1.5-flash'
      const genModel = this.client.getGenerativeModel({ model })

      const chatMessages = Array.isArray(messages)
        ? messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }))
        : [{ role: 'user', parts: [{ text: messages }] }]

      const result = await genModel.generateContent({
        contents: chatMessages,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens || 4096,
        },
      })

      return {
        content: result.response.text(),
        usage: {
          prompt_tokens: result.response.usageMetadata?.promptTokenCount || 0,
          completion_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: result.response.usageMetadata?.totalTokenCount || 0,
        },
        model,
      }
    } catch (err) {
      this._handleError(err, 'chat')
    }
  }

  async embeddings(texts, options = {}) {
    if (!this.client) throw new AIProviderError('Google AI not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'text-embedding-004'
      const genModel = this.client.getGenerativeModel({ model })
      const input = Array.isArray(texts) ? texts : [texts]

      const embeddings = []
      for (const text of input) {
        const result = await genModel.embedContent(text)
        embeddings.push(result.embedding.values)
      }

      return { embeddings, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
    } catch (err) {
      this._handleError(err, 'embeddings')
    }
  }

  async vision(image, prompt, options = {}) {
    if (!this.client) throw new AIProviderError('Google AI not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'gemini-1.5-pro'
      const genModel = this.client.getGenerativeModel({ model })

      const result = await genModel.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: image.replace(/^data:image\/\w+;base64,/, '') } },
          ],
        }],
      })

      return {
        content: result.response.text(),
        usage: {
          prompt_tokens: result.response.usageMetadata?.promptTokenCount || 0,
          completion_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: result.response.usageMetadata?.totalTokenCount || 0,
        },
      }
    } catch (err) {
      this._handleError(err, 'vision')
    }
  }

  async textToImage(prompt, options = {}) {
    if (!this.client) throw new AIProviderError('Google AI not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'gemini-1.5-pro'
      const genModel = this.client.getGenerativeModel({ model })

      const result = await genModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Generate an image: ${prompt}` }] }],
      })

      return {
        content: result.response.text(),
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }
    } catch (err) {
      this._handleError(err, 'textToImage')
    }
  }

  async listModels() {
    return ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'text-embedding-004']
  }
}

export default new GoogleProvider()
