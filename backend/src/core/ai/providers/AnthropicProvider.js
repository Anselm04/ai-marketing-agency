import Anthropic from '@anthropic-ai/sdk'
import { AIProvider, AIProviderError } from '../AIProvider.js'
import logger from '../../../utils/logger.js'

class AnthropicProvider extends AIProvider {
  constructor() {
    super('anthropic')
    this.client = null
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    }
  }

  _checkAvailability() {
    return !!this.client
  }

  async chat(messages, options = {}) {
    if (!this.client) throw new AIProviderError('Anthropic not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'claude-3-5-sonnet-20241022'

      // Convert OpenAI-style messages to Anthropic format
      const systemMessage = messages.find(m => m.role === 'system')?.content || ''
      const chatMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

      const response = await this.client.messages.create({
        model,
        max_tokens: options.maxTokens || 4096,
        system: systemMessage,
        messages: chatMessages,
        temperature: options.temperature ?? 0.7,
      })

      return {
        content: response.content[0].text,
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
      }
    } catch (err) {
      this._handleError(err, 'chat')
    }
  }

  async embeddings(texts, options = {}) {
    throw new AIProviderError('Anthropic does not support embeddings', this.name, 'NOT_SUPPORTED')
  }

  async vision(image, prompt, options = {}) {
    if (!this.client) throw new AIProviderError('Anthropic not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || 'claude-3-5-sonnet-20241022'
      const response = await this.client.messages.create({
        model,
        max_tokens: options.maxTokens || 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.replace(/^data:image\/\w+;base64,/, '') } },
          ],
        }],
      })

      return {
        content: response.content[0].text,
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      }
    } catch (err) {
      this._handleError(err, 'vision')
    }
  }

  async textToImage(prompt, options = {}) {
    throw new AIProviderError('Anthropic does not support image generation', this.name, 'NOT_SUPPORTED')
  }

  async listModels() {
    return ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
  }
}

export default new AnthropicProvider()
