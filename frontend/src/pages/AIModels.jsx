import { useEffect, useState } from 'react'
import api from '../services/api'
import { SkeletonCard, SkeletonMetric } from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'
import { Cpu, Zap, DollarSign, Layers, Activity, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'

const providerColors = {
  openai: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  anthropic: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  google: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  cohere: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  mistral: 'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
  groq: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
  azure: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
  bedrock: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  ollama: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

function ScoreBar({ label, value, colorClass }) {
  const pct = Math.round(value * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function AIModels() {
  const [models, setModels] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedProvider, setSelectedProvider] = useState('all')
  const [sortBy, setSortBy] = useState('quality')
  const [recommending, setRecommending] = useState(false)
  const [recommendation, setRecommendation] = useState('')
  const [recommendationError, setRecommendationError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/ai-models').then(r => r.data),
      api.get('/ai-models/providers').then(r => r.data),
    ])
      .then(([modelsRes, providersRes]) => {
        setModels(modelsRes.models || [])
        setProviders(providersRes.providers || [])
        setError(null)
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load AI models'))
      .finally(() => setLoading(false))
  }, [])

  const recommendForContent = async () => {
    setRecommending(true)
    setRecommendation('')
    setRecommendationError('')
    try {
      const response = await api.post('/orchestrator/select-model', { taskType: 'content-generation', content: '' })
      const name = response.data?.selection?.modelName
      if (typeof name !== 'string' || !name.trim()) throw new Error('Invalid recommendation')
      setRecommendation(name)
    } catch (error) {
      const message = error.response?.data?.error
      setRecommendationError(typeof message === 'string' ? message : 'Could not recommend a model. Try again.')
    } finally {
      setRecommending(false)
    }
  }

  const filtered = models
    .filter(m => selectedProvider === 'all' || m.providerId === selectedProvider)
    .sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0))

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Failed to load models</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Models</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Browse available models. Recommendations are suggestions and do not change your content tools.</p>
      </div>

      <div className="space-y-3">
        <button type="button" onClick={recommendForContent} disabled={recommending || !models.some(model => model.available)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {recommending ? 'Finding a recommendation…' : 'Recommend for content'}
        </button>
        {!models.some(model => model.available) && <p className="text-sm text-gray-500 dark:text-gray-400">No models are available for a recommendation.</p>}
        {recommendation && <p role="status" className="text-sm text-gray-700 dark:text-gray-200">Recommended for content: <strong>{recommendation}</strong>. This suggestion does not change the model used by your content tools.</p>}
        {recommendationError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{recommendationError}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
          <Layers size={16} className="text-gray-400" />
          <select
            className="bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none"
            value={selectedProvider}
            onChange={e => setSelectedProvider(e.target.value)}
          >
            <option value="all">All Providers</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.available ? 'Up' : 'Down'})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
          <Zap size={16} className="text-gray-400" />
          <select
            className="bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="quality">Quality</option>
            <option value="speed">Speed</option>
            <option value="cost">Cost</option>
            <option value="context">Context</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No models found"
          description="No AI models match the selected filter."
          icon={Cpu}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(model => (
            <div key={model.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{model.name}</h3>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 ${providerColors[model.provider] || 'bg-gray-50 text-gray-700'}`}>
                    <Cpu size={12} />
                    {model.provider}
                  </span>
                </div>
                {model.available ? (
                  <CheckCircle size={18} className="text-green-500" />
                ) : (
                  <XCircle size={18} className="text-red-400" />
                )}
              </div>

              <div className="space-y-2 mb-4">
                <ScoreBar label="Quality" value={model.quality} colorClass="bg-blue-500" />
                <ScoreBar label="Speed" value={model.speed} colorClass="bg-green-500" />
                <ScoreBar label="Cost Efficiency" value={model.cost} colorClass="bg-amber-500" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <DollarSign size={12} />
                  <span>{model.inputPrice ? `$${model.inputPrice}/1K in` : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <DollarSign size={12} />
                  <span>{model.outputPrice ? `$${model.outputPrice}/1K out` : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <Layers size={12} />
                  <span>{model.context ? `${(model.context / 1000).toFixed(0)}K ctx` : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <Activity size={12} />
                  <span>{model.vision ? 'Vision' : 'Text only'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => {
                    api.post('/ai-models/estimate', { providerId: model.providerId, modelId: model.id, inputTokens: 1000, outputTokens: 1000 })
                      .then(res => alert(`Estimated cost: $${res.data.estimatedCost.toFixed(4)}`))
                      .catch(() => alert('Cost estimation failed'))
                  }}
                >
                  Estimate Cost
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

