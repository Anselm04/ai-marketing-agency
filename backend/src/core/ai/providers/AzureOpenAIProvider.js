import OpenAI from 'openai'
import { AIProvider, AIProviderError } from '../AIProvider.js'
import logger from '../../../utils/logger.js'

class AzureOpenAIProvider extends AIProvider {
  constructor() {
    super('azure')
    this.client = null
    if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY) {
      try {
        this.client = new OpenAI({
          apiKey: process.env.AZURE_OPENAI_KEY,
          baseURL: `${process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'}`,
          defaultQuery: { 'api-version': '2024-06-01' },
          defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_KEY },
        })
      } catch (err) {
        logger.error('Azure OpenAI client initialization failed', { error: err.message })
      }
    }
  }

  _checkAvailability() {
    return !!this.client
  }

  async chat(messages, options = {}) {
    if (!this.client) throw new AIProviderError('Azure OpenAI not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'
      const chatMessages = Array.isArray(messages)
        ? messages
        : [{ role: 'user', content: messages }]

      const completion = await this.client.chat.completions.create({
        model,
        messages: chatMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 4096,
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
    if (!this.client) throw new AIProviderError('Azure OpenAI not configured', this.name, 'NOT_CONFIGURED')
    try {
      const model = options.model || process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small'
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
    throw new AIProviderError('Azure OpenAI vision via this provider requires separate implementation', this.name, 'NOT_IMPLEMENTED')
  }

  async textToImage(prompt, options = {}) {
    throw new AIProviderError('Azure OpenAI does not support image generation via this provider', this.name, 'NOT_SUPPORTED')
  }

  async listModels() {
    return ['azure-gpt-4o', 'azure-gpt-4o-mini', 'azure-gpt-4-turbo', 'azure-gpt-3.5-turbo']
  }
}

export default new AzureOpenAIProvider()
