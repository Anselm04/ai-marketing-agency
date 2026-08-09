import logger from '../../utils/logger.js'

const modelDefinitions = [
  // OpenAI Models
  { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', description: 'Most capable multimodal model', maxTokens: 128000, costPer1KInput: 0.005, costPer1KOutput: 0.015, modes: ['chat', 'vision'], qualityScore: 10, speedScore: 8, reliabilityScore: 10 },
  { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', description: 'Fast, affordable multimodal model', maxTokens: 128000, costPer1KInput: 0.00015, costPer1KOutput: 0.0006, modes: ['chat', 'vision'], qualityScore: 8, speedScore: 10, reliabilityScore: 10 },
  { id: 'gpt-4-turbo', provider: 'openai', name: 'GPT-4 Turbo', description: 'High capability with 128k context', maxTokens: 128000, costPer1KInput: 0.01, costPer1KOutput: 0.03, modes: ['chat'], qualityScore: 9, speedScore: 7, reliabilityScore: 9 },
  { id: 'gpt-3.5-turbo', provider: 'openai', name: 'GPT-3.5 Turbo', description: 'Fast and cost-effective', maxTokens: 16385, costPer1KInput: 0.0005, costPer1KOutput: 0.0015, modes: ['chat'], qualityScore: 6, speedScore: 10, reliabilityScore: 10 },
  { id: 'dall-e-3', provider: 'openai', name: 'DALL-E 3', description: 'High-quality image generation', maxTokens: 0, costPer1KInput: 0, costPer1KOutput: 0, modes: ['image'], qualityScore: 9, speedScore: 6, reliabilityScore: 9 },
  { id: 'text-embedding-3-large', provider: 'openai', name: 'Text Embedding 3 Large', description: 'Best embeddings for semantic search', maxTokens: 8192, costPer1KInput: 0.00013, costPer1KOutput: 0, modes: ['embeddings'], qualityScore: 9, speedScore: 9, reliabilityScore: 10 },
  { id: 'text-embedding-3-small', provider: 'openai', name: 'Text Embedding 3 Small', description: 'Fast, affordable embeddings', maxTokens: 8192, costPer1KInput: 0.00002, costPer1KOutput: 0, modes: ['embeddings'], qualityScore: 7, speedScore: 10, reliabilityScore: 10 },
  { id: 'whisper-1', provider: 'openai', name: 'Whisper', description: 'Speech-to-text', maxTokens: 0, costPer1KInput: 0, costPer1KOutput: 0, modes: ['audio'], qualityScore: 9, speedScore: 7, reliabilityScore: 9 },

  // Anthropic Models
  { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', name: 'Claude 3.5 Sonnet', description: 'Best balance of intelligence and speed', maxTokens: 200000, costPer1KInput: 0.003, costPer1KOutput: 0.015, modes: ['chat', 'vision'], qualityScore: 9, speedScore: 9, reliabilityScore: 9 },
  { id: 'claude-3-5-haiku-20241022', provider: 'anthropic', name: 'Claude 3.5 Haiku', description: 'Fastest Anthropic model', maxTokens: 200000, costPer1KInput: 0.0008, costPer1KOutput: 0.004, modes: ['chat'], qualityScore: 7, speedScore: 10, reliabilityScore: 9 },
  { id: 'claude-3-opus-20240229', provider: 'anthropic', name: 'Claude 3 Opus', description: 'Highest capability for complex tasks', maxTokens: 200000, costPer1KInput: 0.015, costPer1KOutput: 0.075, modes: ['chat', 'vision'], qualityScore: 10, speedScore: 6, reliabilityScore: 9 },

  // Google Models
  { id: 'gemini-1.5-pro', provider: 'google', name: 'Gemini 1.5 Pro', description: 'Google\'s most capable model with 1M context', maxTokens: 2097152, costPer1KInput: 0.0035, costPer1KOutput: 0.0105, modes: ['chat', 'vision'], qualityScore: 9, speedScore: 8, reliabilityScore: 8 },
  { id: 'gemini-1.5-flash', provider: 'google', name: 'Gemini 1.5 Flash', description: 'Fast, cost-effective Google model', maxTokens: 1048576, costPer1KInput: 0.00035, costPer1KOutput: 0.00105, modes: ['chat', 'vision'], qualityScore: 7, speedScore: 10, reliabilityScore: 8 },
  { id: 'gemini-1.5-flash-8b', provider: 'google', name: 'Gemini 1.5 Flash 8B', description: 'Ultra-fast, cheapest Gemini', maxTokens: 1048576, costPer1KInput: 0.000075, costPer1KOutput: 0.0003, modes: ['chat'], qualityScore: 6, speedScore: 10, reliabilityScore: 8 },

  // Mistral Models
  { id: 'mistral-large-latest', provider: 'mistral', name: 'Mistral Large', description: 'Mistral\'s flagship model', maxTokens: 128000, costPer1KInput: 0.002, costPer1KOutput: 0.006, modes: ['chat'], qualityScore: 8, speedScore: 8, reliabilityScore: 8 },
  { id: 'mistral-medium', provider: 'mistral', name: 'Mistral Medium', description: 'Balanced performance and cost', maxTokens: 32000, costPer1KInput: 0.0009, costPer1KOutput: 0.0027, modes: ['chat'], qualityScore: 7, speedScore: 9, reliabilityScore: 8 },
  { id: 'mistral-small', provider: 'mistral', name: 'Mistral Small', description: 'Fast, lightweight model', maxTokens: 32000, costPer1KInput: 0.0002, costPer1KOutput: 0.0006, modes: ['chat'], qualityScore: 6, speedScore: 10, reliabilityScore: 8 },
  { id: 'codestral-latest', provider: 'mistral', name: 'Codestral', description: 'Code generation specialist', maxTokens: 32000, costPer1KInput: 0.0002, costPer1KOutput: 0.0006, modes: ['chat'], qualityScore: 8, speedScore: 9, reliabilityScore: 8 },
  { id: 'pixtral-large-latest', provider: 'mistral', name: 'Pixtral Large', description: 'Vision-capable Mistral model', maxTokens: 128000, costPer1KInput: 0.002, costPer1KOutput: 0.006, modes: ['chat', 'vision'], qualityScore: 7, speedScore: 8, reliabilityScore: 7 },

  // Local / Ollama Models
  { id: 'llama3.1', provider: 'ollama', name: 'Llama 3.1 8B', description: 'Meta\'s latest open-source model', maxTokens: 128000, costPer1KInput: 0, costPer1KOutput: 0, modes: ['chat'], qualityScore: 6, speedScore: 8, reliabilityScore: 7 },
  { id: 'llama3.1-70b', provider: 'ollama', name: 'Llama 3.1 70B', description: 'Large open-source model for local inference', maxTokens: 128000, costPer1KInput: 0, costPer1KOutput: 0, modes: ['chat'], qualityScore: 8, speedScore: 5, reliabilityScore: 7 },
  { id: 'mistral-7b', provider: 'ollama', name: 'Mistral 7B', description: 'Efficient open-source model', maxTokens: 32000, costPer1KInput: 0, costPer1KOutput: 0, modes: ['chat'], qualityScore: 6, speedScore: 9, reliabilityScore: 7 },
  { id: 'qwen2.5', provider: 'ollama', name: 'Qwen 2.5', description: 'Alibaba\'s multilingual model', maxTokens: 128000, costPer1KInput: 0, costPer1KOutput: 0, modes: ['chat'], qualityScore: 7, speedScore: 8, reliabilityScore: 7 },
  { id: 'phi4', provider: 'ollama', name: 'Phi-4', description: 'Microsoft\'s compact model', maxTokens: 16000, costPer1KInput: 0, costPer1KOutput: 0, modes: ['chat'], qualityScore: 6, speedScore: 9, reliabilityScore: 7 },
  { id: 'deepseek-coder', provider: 'ollama', name: 'DeepSeek Coder', description: 'Code-focused open model', maxTokens: 16000, costPer1KInput: 0, costPer1KOutput: 0, modes: ['chat'], qualityScore: 7, speedScore: 8, reliabilityScore: 7 },

  // Azure OpenAI
  { id: 'azure-gpt-4o', provider: 'azure', name: 'Azure GPT-4o', description: 'Enterprise GPT-4o via Azure', maxTokens: 128000, costPer1KInput: 0.005, costPer1KOutput: 0.015, modes: ['chat', 'vision'], qualityScore: 10, speedScore: 8, reliabilityScore: 10 },
  { id: 'azure-gpt-4o-mini', provider: 'azure', name: 'Azure GPT-4o Mini', description: 'Enterprise fast model via Azure', maxTokens: 128000, costPer1KInput: 0.000165, costPer1KOutput: 0.00066, modes: ['chat', 'vision'], qualityScore: 8, speedScore: 10, reliabilityScore: 10 },

  // AWS Bedrock
  { id: 'anthropic.claude-3-5-sonnet', provider: 'bedrock', name: 'Bedrock Claude 3.5 Sonnet', description: 'Claude via AWS Bedrock', maxTokens: 200000, costPer1KInput: 0.003, costPer1KOutput: 0.015, modes: ['chat', 'vision'], qualityScore: 9, speedScore: 9, reliabilityScore: 10 },
  { id: 'anthropic.claude-3-haiku', provider: 'bedrock', name: 'Bedrock Claude 3 Haiku', description: 'Fast Claude via AWS', maxTokens: 200000, costPer1KInput: 0.00025, costPer1KOutput: 0.00125, modes: ['chat'], qualityScore: 7, speedScore: 10, reliabilityScore: 10 },
  { id: 'amazon.nova-pro', provider: 'bedrock', name: 'Amazon Nova Pro', description: 'Amazon\'s flagship model', maxTokens: 300000, costPer1KInput: 0.0008, costPer1KOutput: 0.0032, modes: ['chat', 'vision'], qualityScore: 8, speedScore: 9, reliabilityScore: 9 },
  { id: 'amazon.nova-micro', provider: 'bedrock', name: 'Amazon Nova Micro', description: 'Fast, cheap Amazon model', maxTokens: 128000, costPer1KInput: 0.000035, costPer1KOutput: 0.00014, modes: ['chat'], qualityScore: 6, speedScore: 10, reliabilityScore: 9 },
  { id: 'meta.llama3-1-70b', provider: 'bedrock', name: 'Bedrock Llama 3.1 70B', description: 'Llama via AWS Bedrock', maxTokens: 128000, costPer1KInput: 0.00072, costPer1KOutput: 0.00072, modes: ['chat'], qualityScore: 7, speedScore: 8, reliabilityScore: 9 },
  { id: 'meta.llama3-1-8b', provider: 'bedrock', name: 'Bedrock Llama 3.1 8B', description: 'Fast Llama via AWS', maxTokens: 128000, costPer1KInput: 0.00013, costPer1KOutput: 0.00013, modes: ['chat'], qualityScore: 6, speedScore: 10, reliabilityScore: 9 },

  // Cohere
  { id: 'command-r-plus', provider: 'cohere', name: 'Command R+', description: 'Cohere\'s best model for RAG', maxTokens: 128000, costPer1KInput: 0.003, costPer1KOutput: 0.015, modes: ['chat'], qualityScore: 7, speedScore: 8, reliabilityScore: 8 },
  { id: 'command-r', provider: 'cohere', name: 'Command R', description: 'Balanced Cohere model', maxTokens: 128000, costPer1KInput: 0.0005, costPer1KOutput: 0.0015, modes: ['chat'], qualityScore: 6, speedScore: 9, reliabilityScore: 8 },
  { id: 'embed-english-v3', provider: 'cohere', name: 'Embed English v3', description: 'Cohere embeddings', maxTokens: 512, costPer1KInput: 0.0001, costPer1KOutput: 0, modes: ['embeddings'], qualityScore: 7, speedScore: 10, reliabilityScore: 8 },
]

class ModelRegistry {
  constructor() {
    this.models = new Map()
    modelDefinitions.forEach(m => this.models.set(m.id, m))
    logger.info(`ModelRegistry initialized with ${this.models.size} models`)
  }

  getAll() {
    return Array.from(this.models.values())
  }

  getByProvider(provider) {
    return this.getAll().filter(m => m.provider === provider)
  }

  getByMode(mode) {
    return this.getAll().filter(m => m.modes.includes(mode))
  }

  getById(id) {
    return this.models.get(id) || null
  }

  getByTask(taskType) {
    const taskModeMap = {
      'strategy': ['chat'],
      'creative': ['chat', 'vision'],
      'optimization': ['chat'],
      'compliance': ['chat'],
      'operations': ['chat'],
      'meta': ['chat'],
      'code': ['chat'],
      'image': ['image'],
      'vision': ['vision'],
      'embeddings': ['embeddings'],
      'audio': ['audio'],
      'translation': ['chat'],
      'summarization': ['chat'],
      'reasoning': ['chat'],
    }
    const modes = taskModeMap[taskType] || ['chat']
    return this.getAll().filter(m => modes.some(mode => m.modes.includes(mode)))
  }

  estimateCost(modelId, inputTokens, outputTokens) {
    const model = this.getById(modelId)
    if (!model) return null
    const inputCost = (inputTokens / 1000) * model.costPer1KInput
    const outputCost = (outputTokens / 1000) * model.costPer1KOutput
    return { inputCost, outputCost, totalCost: inputCost + outputCost, currency: 'USD' }
  }

  register(model) {
    this.models.set(model.id, model)
    logger.info(`Model registered: ${model.id}`)
  }
}

export default new ModelRegistry()
