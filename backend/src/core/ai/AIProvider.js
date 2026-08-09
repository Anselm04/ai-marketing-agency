import logger from '../../utils/logger.js'

export class AIProviderError extends Error {
  constructor(message, provider, code) {
    super(message)
    this.provider = provider
    this.code = code
    this.name = 'AIProviderError'
  }
}

export class AIProvider {
  constructor(name, config = {}) {
    this.name = name
    this.config = config
    this.available = this._checkAvailability()
  }

  _checkAvailability() {
    return true
  }

  isAvailable() {
    return this.available
  }

  async chat(messages, options = {}) {
    throw new AIProviderError(`chat() not implemented for ${this.name}`, this.name, 'NOT_IMPLEMENTED')
  }

  async embeddings(texts, options = {}) {
    throw new AIProviderError(`embeddings() not implemented for ${this.name}`, this.name, 'NOT_IMPLEMENTED')
  }

  async vision(image, prompt, options = {}) {
    throw new AIProviderError(`vision() not implemented for ${this.name}`, this.name, 'NOT_IMPLEMENTED')
  }

  async textToImage(prompt, options = {}) {
    throw new AIProviderError(`textToImage() not implemented for ${this.name}`, this.name, 'NOT_IMPLEMENTED')
  }

  async listModels() {
    return []
  }

  getModelInfo(modelId) {
    return null
  }

  _handleError(err, operation) {
    logger.error(`AI Provider ${this.name} ${operation} failed`, { error: err.message, provider: this.name })
    throw new AIProviderError(err.message, this.name, err.code || 'UNKNOWN')
  }
}

export default AIProvider
