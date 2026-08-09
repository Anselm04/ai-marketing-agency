import logger from '../../utils/logger.js'
import ModelRegistry from './ModelRegistry.js'
import Cache from '../Cache.js'

class CircuitBreaker {
  constructor(threshold = 5, timeout = 30000) {
    this.failures = 0
    this.threshold = threshold
    this.timeout = timeout
    this.state = 'CLOSED' // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = 0
  }

  canExecute() {
    if (this.state === 'CLOSED') return true
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN'
        return true
      }
      return false
    }
    return true // HALF_OPEN
  }

  recordSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  recordFailure() {
    this.failures += 1
    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
      this.nextAttempt = Date.now() + this.timeout
      logger.warn(`Circuit breaker opened for provider`, { failures: this.failures, timeout: this.timeout })
    }
  }
}

class AIRouter {
  constructor() {
    this.providers = new Map()
    this.circuitBreakers = new Map()
    this.defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'openai'
    this.fallbackChain = ['openai', 'anthropic', 'google', 'mistral', 'ollama']
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider)
    this.circuitBreakers.set(name, new CircuitBreaker())
    logger.info(`AI provider registered: ${name}`, { available: provider.isAvailable() })
  }

  getProvider(name) {
    return this.providers.get(name)
  }

  getAllProviders() {
    return Array.from(this.providers.entries())
  }

  selectModel(task, requirements = {}) {
    const {
      mode = 'chat',
      quality = 'balanced', // 'fast', 'balanced', 'premium'
      budget = null,
      maxTokens = null,
      preferredProvider = null,
      excludeProviders = [],
    } = requirements

    let candidates = ModelRegistry.getByMode(mode)

    if (preferredProvider) {
      candidates = candidates.filter(m => m.provider === preferredProvider)
    }

    if (excludeProviders.length > 0) {
      candidates = candidates.filter(m => !excludeProviders.includes(m.provider))
    }

    if (maxTokens) {
      candidates = candidates.filter(m => m.maxTokens >= maxTokens)
    }

    // Filter by circuit breaker availability
    candidates = candidates.filter(m => {
      const cb = this.circuitBreakers.get(m.provider)
      return cb ? cb.canExecute() : true
    })

    // Filter by provider availability
    candidates = candidates.filter(m => {
      const provider = this.providers.get(m.provider)
      return provider ? provider.isAvailable() : false
    })

    if (candidates.length === 0) {
      logger.warn('No available AI models for task', { task, mode, requirements })
      return null
    }

    // Score candidates based on quality preference
    const scored = candidates.map(m => {
      let score = 0

      // Quality weighting
      if (quality === 'premium') {
        score += m.qualityScore * 10
        score += m.reliabilityScore * 5
      } else if (quality === 'fast') {
        score += m.speedScore * 10
        score -= m.costPer1KInput * 100 // Prefer cheaper
      } else { // balanced
        score += m.qualityScore * 5
        score += m.speedScore * 5
        score += m.reliabilityScore * 3
        score -= m.costPer1KInput * 50
      }

      // Provider reliability bonus
      const cb = this.circuitBreakers.get(m.provider)
      if (cb && cb.state === 'CLOSED') score += 5

      return { model: m, score }
    })

    scored.sort((a, b) => b.score - a.score)
    const selected = scored[0].model

    logger.info(`Selected model: ${selected.id} for task ${task}`, { quality, provider: selected.provider })
    return selected
  }

  async execute(task, payload, requirements = {}) {
    const selected = this.selectModel(task, requirements)
    if (!selected) {
      throw new Error(`No AI model available for task: ${task}`)
    }

    const provider = this.providers.get(selected.provider)
    const cb = this.circuitBreakers.get(selected.provider)

    try {
      let result
      switch (task) {
        case 'chat':
        case 'strategy':
        case 'creative':
        case 'optimization':
        case 'compliance':
        case 'operations':
        case 'meta':
        case 'translation':
        case 'summarization':
        case 'reasoning':
        case 'code':
          result = await provider.chat(payload.messages || payload, {
            model: selected.id,
            ...payload.options,
          })
          break
        case 'vision':
          result = await provider.vision(payload.image, payload.prompt, {
            model: selected.id,
            ...payload.options,
          })
          break
        case 'embeddings':
          result = await provider.embeddings(payload.texts, {
            model: selected.id,
            ...payload.options,
          })
          break
        case 'image':
          result = await provider.textToImage(payload.prompt, {
            model: selected.id,
            ...payload.options,
          })
          break
        case 'audio':
          result = await provider.audio(payload.audio, {
            model: selected.id,
            ...payload.options,
          })
          break
        default:
          result = await provider.chat(payload.messages || payload, {
            model: selected.id,
            ...payload.options,
          })
      }

      cb.recordSuccess()
      return { result, model: selected.id, provider: selected.provider }
    } catch (err) {
      cb.recordFailure()
      logger.error(`AI execution failed on ${selected.provider}`, { error: err.message, task })

      // Try fallback chain
      for (const fallbackProvider of this.fallbackChain) {
        if (fallbackProvider === selected.provider) continue
        const fallback = this.providers.get(fallbackProvider)
        const fallbackCb = this.circuitBreakers.get(fallbackProvider)

        if (!fallback || !fallback.isAvailable() || !fallbackCb.canExecute()) continue

        try {
          logger.info(`Trying fallback provider: ${fallbackProvider}`)
          const fallbackResult = await fallback.chat(payload.messages || payload, {
            model: selected.id,
            ...payload.options,
          })
          fallbackCb.recordSuccess()
          return { result: fallbackResult, model: selected.id, provider: fallbackProvider, fallback: true }
        } catch (fallbackErr) {
          fallbackCb.recordFailure()
          logger.error(`Fallback ${fallbackProvider} also failed`, { error: fallbackErr.message })
        }
      }

      throw err
    }
  }

  async executeParallel(tasks) {
    const promises = tasks.map(t =>
      this.execute(t.task, t.payload, t.requirements).then(r => ({
        ...r,
        taskId: t.id || t.task,
      })).catch(err => ({
        error: err.message,
        taskId: t.id || t.task,
      }))
    )
    return Promise.allSettled(promises)
  }

  async chat(messages, requirements = {}) {
    return this.execute('chat', { messages }, requirements)
  }

  async embeddings(texts, requirements = {}) {
    return this.execute('embeddings', { texts }, { mode: 'embeddings', ...requirements })
  }

  async vision(image, prompt, requirements = {}) {
    return this.execute('vision', { image, prompt }, { mode: 'vision', ...requirements })
  }

  async textToImage(prompt, requirements = {}) {
    return this.execute('image', { prompt }, { mode: 'image', ...requirements })
  }
}

export default new AIRouter()
