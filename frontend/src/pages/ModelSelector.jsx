import { useState, useEffect } from 'react'
import api from '../services/api.js'
import { useToast } from '../context/ToastContext'
import {
  Brain, Zap, TrendingUp, DollarSign, Hash, Gauge, Check, ChevronDown,
  Sparkles, Cpu, Wifi, WifiOff, Filter, Search
} from 'lucide-react'

const providerColors = {
  openai: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  anthropic: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  google: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  mistral: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  ollama: 'bg-slate-50 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  azure: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  bedrock: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  cohere: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
}

const providerLabels = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral AI',
  ollama: 'Ollama (Local)',
  azure: 'Azure OpenAI',
  bedrock: 'AWS Bedrock',
  cohere: 'Cohere',
}

const qualityLabels = { fast: 'Fast', balanced: 'Balanced', premium: 'Premium' }

export default function ModelSelector() {
  const { showToast } = useToast()
  const [models, setModels] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ provider: 'all', mode: 'all', quality: 'balanced' })
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [estimation, setEstimation] = useState({ input: 1000, output: 1000 })

  useEffect(() => {
    loadModels()
  }, [])

  async function loadModels() {
    try {
      setLoading(true)
      const [modelsRes, providersRes] = await Promise.all([
        api.get('/models'),
        api.get('/models/providers'),
      ])
      setModels(modelsRes.data.models || [])
      setProviders(providersRes.data.providers || [])
    } catch (err) {
      showToast('Failed to load models', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function estimateCost(modelId) {
    try {
      const res = await api.get(`/models/${modelId}/cost?inputTokens=${estimation.input}&outputTokens=${estimation.output}`)
      return res.data.cost
    } catch {
      return null
    }
  }

  const modes = [...new Set(models.flatMap(m => m.modes))]

  const filtered = models.filter(m => {
    if (filter.provider !== 'all' && m.provider !== filter.provider) return false
    if (filter.mode !== 'all' && !m.modes.includes(filter.mode)) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (filter.quality === 'premium') return b.qualityScore - a.qualityScore
    if (filter.quality === 'fast') return b.speedScore - a.speedScore
    return (b.qualityScore + b.speedScore) - (a.qualityScore + a.speedScore)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Model Selector</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Choose the right AI model for every task. {models.length} models across {providers.length} providers.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search models..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <select
          value={filter.provider}
          onChange={e => setFilter({ ...filter, provider: e.target.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        >
          <option value="all">All providers</option>
          {providers.map(p => (
            <option key={p} value={p}>{providerLabels[p] || p}</option>
          ))}
        </select>
        <select
          value={filter.mode}
          onChange={e => setFilter({ ...filter, mode: e.target.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        >
          <option value="all">All modes</option>
          {modes.map(m => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
        <select
          value={filter.quality}
          onChange={e => setFilter({ ...filter, quality: e.target.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        >
          {Object.entries(qualityLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Cost estimation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Cost estimation:</span>
          <div className="flex items-center gap-2">
            <label className="text-gray-700 dark:text-gray-300">Input tokens</label>
            <input
              type="number"
              value={estimation.input}
              onChange={e => setEstimation({ ...estimation, input: parseInt(e.target.value) || 0 })}
              className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-700 dark:text-gray-300">Output tokens</label>
            <input
              type="number"
              value={estimation.output}
              onChange={e => setEstimation({ ...estimation, output: parseInt(e.target.value) || 0 })}
              className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Models grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4" />
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))
        ) : (
          sorted.map(model => {
            const isSelected = selected?.id === model.id
            return (
              <div
                key={model.id}
                onClick={() => setSelected(isSelected ? null : model)}
                className={`bg-white dark:bg-gray-800 rounded-lg border p-5 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 dark:border-blue-400 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${providerColors[model.provider] || 'bg-gray-50'}`}>
                      <Cpu size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{model.name}</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{model.id}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${providerColors[model.provider] || 'bg-gray-100'}`}>
                    {providerLabels[model.provider] || model.provider}
                  </span>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{model.description}</p>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{model.qualityScore}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Quality</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{model.speedScore}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Speed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{model.reliabilityScore}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Reliability</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{model.maxTokens >= 1000000 ? `${(model.maxTokens / 1000000).toFixed(1)}M` : model.maxTokens >= 1000 ? `${(model.maxTokens / 1000).toFixed(0)}K` : model.maxTokens}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Context</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {model.modes.map(mode => (
                    <span key={mode} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                      {mode}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">${(model.costPer1KInput + model.costPer1KOutput).toFixed(4)}</span> / 1K tokens
                  </div>
                  <div className="flex items-center gap-1">
                    {model.costPer1KInput === 0 && model.costPer1KOutput === 0 ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Zap size={14} /> Free
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Paid</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {selected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/50 p-4">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-300">Recommended for</h4>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                {selected.modes.includes('vision') && 'Image analysis and visual content generation. '}
                {selected.modes.includes('image') && 'AI image generation for marketing creatives. '}
                {selected.modes.includes('chat') && 'Text generation, strategy, and content creation. '}
                {selected.modes.includes('embeddings') && 'Semantic search and vector operations. '}
                {selected.qualityScore >= 9 && 'Best for complex reasoning and high-quality outputs. '}
                {selected.speedScore >= 9 && 'Optimized for high-throughput, real-time applications. '}
                {selected.costPer1KInput === 0 && 'Zero cost - ideal for budget-conscious workflows. '}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
