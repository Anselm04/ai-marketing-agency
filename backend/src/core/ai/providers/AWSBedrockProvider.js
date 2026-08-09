import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { AIProvider, AIProviderError } from '../AIProvider.js'
import logger from '../../../utils/logger.js'

class AWSBedrockProvider extends AIProvider {
  constructor() {
    super('bedrock')
    this.client = null
    if (process.env.AWS_REGION && (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE)) {
      this.client = new BedrockRuntimeClient({
        region: process.env.AWS_REGION,
        credentials: process.env.AWS_ACCESS_KEY_ID ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        } : undefined,
      })
    }
  }

  _checkAvailability() {
    return !!this.client
  }

  async chat(messages, options = {}) {
    if (!this.client) throw new AIProviderError('AWS Bedrock not configured', this.name, 'NOT_CONFIGURED')
    try {
      const modelId = options.model || 'anthropic.claude-3-5-sonnet'
      const chatMessages = Array.isArray(messages)
        ? messages
        : [{ role: 'user', content: messages }]

      // Format depends on model provider
      let body
      if (modelId.includes('anthropic')) {
        body = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: options.maxTokens || 4096,
          messages: chatMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
          temperature: options.temperature ?? 0.7,
        }
      } else if (modelId.includes('amazon')) {
        body = {
          inputText: chatMessages.map(m => m.content).join('\n'),
          textGenerationConfig: {
            maxTokenCount: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
          },
        }
      } else {
        body = { prompt: chatMessages.map(m => m.content).join('\n'), max_tokens: options.maxTokens || 4096 }
      }

      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify(body),
        contentType: 'application/json',
      })

      const response = await this.client.send(command)
      const responseBody = JSON.parse(new TextDecoder().decode(response.body))

      let content
      if (modelId.includes('anthropic')) {
        content = responseBody.content?.[0]?.text || responseBody.completion
      } else if (modelId.includes('amazon')) {
        content = responseBody.results?.[0]?.outputText || responseBody.outputText
      } else {
        content = responseBody.generation || responseBody.completion
      }

      return {
        content,
        usage: responseBody.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model: modelId,
      }
    } catch (err) {
      this._handleError(err, 'chat')
    }
  }

  async embeddings(texts, options = {}) {
    if (!this.client) throw new AIProviderError('AWS Bedrock not configured', this.name, 'NOT_CONFIGURED')
    try {
      const modelId = options.model || 'amazon.titan-embed-text-v2'
      const input = Array.isArray(texts) ? texts : [texts]
      const embeddings = []

      for (const text of input) {
        const command = new InvokeModelCommand({
          modelId,
          body: JSON.stringify({ inputText: text }),
          contentType: 'application/json',
        })
        const response = await this.client.send(command)
        const body = JSON.parse(new TextDecoder().decode(response.body))
        embeddings.push(body.embedding)
      }

      return { embeddings, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
    } catch (err) {
      this._handleError(err, 'embeddings')
    }
  }

  async vision(image, prompt, options = {}) {
    throw new AIProviderError('AWS Bedrock vision requires multi-modal model configuration', this.name, 'NOT_IMPLEMENTED')
  }

  async textToImage(prompt, options = {}) {
    throw new AIProviderError('AWS Bedrock image generation via Titan', this.name, 'NOT_IMPLEMENTED')
  }

  async listModels() {
    return [
      'anthropic.claude-3-5-sonnet',
      'anthropic.claude-3-haiku',
      'amazon.nova-pro',
      'amazon.nova-micro',
      'meta.llama3-1-70b',
      'meta.llama3-1-8b',
    ]
  }
}

export default new AWSBedrockProvider()
