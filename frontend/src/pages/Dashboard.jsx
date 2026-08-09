import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Users, Eye, MousePointer, AlertTriangle } from 'lucide-react'
import api from '../services/api'
import { SkeletonMetric } from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/analytics/dashboard')
      .then(res => { setStats(res.data); setError(null); })
      .catch(err => setError(err.response?.data?.error || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonMetric /><SkeletonMetric /><SkeletonMetric />
          <SkeletonMetric /><SkeletonMetric /><SkeletonMetric />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Something went wrong</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    { label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, trend: '+12%', up: true },
    { label: 'Total Spend', value: `$${stats.totalSpend.toLocaleString()}`, icon: DollarSign, trend: '+8%', up: false },
    { label: 'Overall ROI', value: `${stats.overallRoi}x`, icon: TrendingUp, trend: '+0.3', up: true },
    { label: 'Impressions', value: `${(stats.impressions / 1000000).toFixed(1)}M`, icon: Eye, trend: '+24%', up: true },
    { label: 'Clicks', value: `${(stats.clicks / 1000).toFixed(1)}K`, icon: MousePointer, trend: '+15%', up: true },
    { label: 'Conversions', value: `${stats.conversions.toLocaleString()}`, icon: Users, trend: '+9%', up: true },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time overview of your AI marketing operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, trend, up }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
              </div>
              <div className={`p-2 rounded-lg ${up ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                <Icon size={20} />
              </div>
            </div>
            <div className={`flex items-center gap-1 mt-3 text-sm font-medium ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {trend}
              <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">vs last week</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Platform Breakdown</h3>
          {stats.platformBreakdown?.length > 0 ? (
            <div className="space-y-3">
              {stats.platformBreakdown.map(p => (
                <div key={p.platform}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">{p.platform}</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{p.roi}x ROI</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min((p.roi / 4) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No platform data"
              description="Create campaigns and connect platforms to see performance breakdowns."
              icon={AlertTriangle}
            />
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Active Agents</h3>
          <div className="space-y-2">
            {['Chief Strategy', 'Social Media', 'Content', 'Video', 'Market Research'].map(name => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{name} Agent</span>
                </div>
                <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">Running</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}