import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Users, Eye, MousePointer } from 'lucide-react'
import api from '../services/api'

export default function Dashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/analytics/dashboard').then(res => setStats(res.data))
  }, [])

  if (!stats) return <div className="p-6">Loading...</div>

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
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Real-time overview of your AI marketing operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, trend, up }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`p-2 rounded-lg ${up ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                <Icon size={20} />
              </div>
            </div>
            <div className={`flex items-center gap-1 mt-3 text-sm font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
              {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {trend}
              <span className="text-gray-400 font-normal ml-1">vs last week</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Platform Breakdown</h3>
          <div className="space-y-3">
            {stats.platformBreakdown.map(p => (
              <div key={p.platform}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{p.platform}</span>
                  <span className="text-gray-900 font-medium">{p.roi}x ROI</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(p.roi / 4) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Active Agents</h3>
          <div className="space-y-2">
            {['Chief Strategy', 'Social Media', 'Content', 'Video', 'Market Research'].map(name => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-700">{name} Agent</span>
                </div>
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">Running</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}