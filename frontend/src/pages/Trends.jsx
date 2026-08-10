import { useEffect, useState } from 'react'
import { TrendingUp, Sparkles, Hash, BarChart3, RefreshCw } from 'lucide-react'
import api from '../services/api'

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
    const res = await api.post('/trends/predict', { niche })
    setPrediction(res.data)
    setLoading(false)
  }

  const handleViral = async () => {
    setLoading(true)
    const res = await api.post('/trends/viral-content', { brand, niche })
    setViral(res.data)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Trends & Insights</h2>
          <p className="text-gray-500 mt-1">Real-time market trends and viral predictions</p>
        </div>
        <button onClick={fetchTrends} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {trends && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Hash size={18} className="text-pink-500" />
              <h3 className="font-semibold text-gray-900">TikTok Trends</h3>
            </div>
            <div className="space-y-2">
              {trends.tiktok?.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{t.hashtag || t.topic}</span>
                  <span className="text-gray-500">{t.volume || t.interest}</span>
                </div>
              )) || <div className="text-sm text-gray-400">No data</div>}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} className="text-blue-500" />
              <h3 className="font-semibold text-gray-900">Twitter/X Trends</h3>
            </div>
            <div className="space-y-2">
              {trends.twitter?.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{t.topic}</span>
                  <span className={`text-xs ${t.sentiment === 'positive' ? 'text-green-600' : 'text-red-600'}`}>{t.sentiment}</span>
                </div>
              )) || <div className="text-sm text-gray-400">No data</div>}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={18} className="text-green-500" />
              <h3 className="font-semibold text-gray-900">Google Trends</h3>
            </div>
            <div className="space-y-2">
              {trends.google?.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{t.keyword}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{t.interest}</span>
                    <span className={`text-xs ${(t.change || '').startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>{t.change}</span>
                  </div>
                </div>
              )) || <div className="text-sm text-gray-400">No data</div>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Predict Trends</h3>
          <div className="flex gap-2 mb-4">
            <input type="text" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" value={niche} onChange={e => setNiche(e.target.value)} placeholder="Niche" />
            <button onClick={handlePredict} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              <Sparkles size={16} />
            </button>
          </div>
          {prediction && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{prediction.content || prediction.fallback ? 'Prediction unavailable' : JSON.stringify(prediction, null, 2)}</div>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Viral Content Ideas</h3>
          <div className="flex gap-2 mb-4">
            <input type="text" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand" />
            <button onClick={handleViral} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              <Sparkles size={16} />
            </button>
          </div>
          {viral && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{viral.content || viral.fallback ? 'Ideas unavailable' : JSON.stringify(viral, null, 2)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
