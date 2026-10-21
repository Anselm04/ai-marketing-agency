import { useEffect, useState } from 'react'
import { TrendingUp, Sparkles, Hash, BarChart3, RefreshCw } from 'lucide-react'
import api from '../services/api'

const rows = (source) => Array.isArray(source?.trends) ? source.trends : []

function SourceStatus({ source }) {
  if (source?.verified && source?.available) {
    return <div className="text-xs text-green-700 mb-2">Verified provider data</div>
  }
  return <div className="text-sm text-amber-700 mb-2">{source?.reason || 'Current verified source unavailable.'}</div>
}

export default function Trends() {
  const [trends, setTrends] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [viral, setViral] = useState(null)
  const [loading, setLoading] = useState(false)
  const [niche, setNiche] = useState('SaaS')
  const [brand, setBrand] = useState('Trillion AI Tech')

  useEffect(() => {
    fetchTrends()
  }, [])

  const fetchTrends = async () => {
    const res = await api.get('/trends')
    setTrends(res.data)
  }

  const handlePredict = async () => {
    setLoading(true)
    try {
      const res = await api.post('/trends/predict', { niche })
      setPrediction(res.data)
    } finally {
      setLoading(false)
    }
  }

  const handleViral = async () => {
    setLoading(true)
    try {
      const res = await api.post('/trends/viral-content', { brand, niche })
      setViral(res.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Trends & Insights</h2>
          <p className="text-gray-500 mt-1">Verified current data where a source is connected. Missing research is shown as unavailable, never invented.</p>
        </div>
        <button onClick={fetchTrends} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {trends?.dataPolicy && (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900">
          {trends.dataPolicy}
        </div>
      )}

      {trends && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ['TikTok Trends', trends.tiktok, Hash, 'text-pink-500'],
            ['Twitter/X Trends', trends.twitter, TrendingUp, 'text-blue-500'],
            ['Google Trends', trends.google, BarChart3, 'text-green-500'],
          ].map(([title, source, Icon, iconClass]) => (
            <div className="bg-white rounded-lg border border-gray-200 p-5" key={title}>
              <div className="flex items-center gap-2 mb-3">
                <Icon size={18} className={iconClass} />
                <h3 className="font-semibold text-gray-900">{title}</h3>
              </div>
              <SourceStatus source={source} />
              <div className="space-y-2">
                {rows(source).length > 0 ? rows(source).map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.hashtag || item.topic || item.keyword || item.name}</span>
                    <span className="text-gray-500">{item.volume || item.interest || ''}</span>
                  </div>
                )) : <div className="text-sm text-gray-400">No verified data to display</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-2">AI Trend Hypotheses</h3>
          <p className="text-sm text-gray-500 mb-4">Brainstorm possible themes to investigate. These are model hypotheses, not measured current trends.</p>
          <div className="flex gap-2 mb-4">
            <input type="text" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" value={niche} onChange={e => setNiche(e.target.value)} placeholder="Niche" />
            <button onClick={handlePredict} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50" aria-label="Generate hypotheses">
              <Sparkles size={16} />
            </button>
          </div>
          {prediction && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
              {prediction.warning && <div className="mb-2 text-amber-700">{prediction.warning}</div>}
              {prediction.result?.content || (prediction.result?.fallback ? 'Hypotheses unavailable' : JSON.stringify(prediction.result, null, 2))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Content Test Ideas</h3>
          <p className="text-sm text-gray-500 mb-4">Creative ideas to test. No claim that an idea is currently trending or will go viral.</p>
          <div className="flex gap-2 mb-4">
            <input type="text" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand" />
            <button onClick={handleViral} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50" aria-label="Generate content test ideas">
              <Sparkles size={16} />
            </button>
          </div>
          {viral && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
              {viral.warning && <div className="mb-2 text-amber-700">{viral.warning}</div>}
              {viral.result?.content || (viral.result?.fallback ? 'Ideas unavailable' : JSON.stringify(viral.result, null, 2))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
