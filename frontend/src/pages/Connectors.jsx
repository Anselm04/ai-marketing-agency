import { useEffect, useState } from 'react'
import api from '../services/api'
import { SkeletonCard } from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'
import {
  Plug, Link2, Unlink, Globe, ShoppingCart, MessageSquare, BarChart3, Mail, Cloud, Music, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, ExternalLink
} from 'lucide-react'

const categoryIcons = {
  social: MessageSquare,
  ecommerce: ShoppingCart,
  analytics: BarChart3,
  crm: Mail,
  messaging: MessageSquare,
  storage: Cloud,
  audio: Music,
  default: Plug,
}

const categoryLabels = {
  social: 'Social Media',
  ecommerce: 'E-Commerce',
  analytics: 'Analytics',
  crm: 'CRM & Email',
  messaging: 'Messaging',
  storage: 'Storage',
  audio: 'Audio & Podcast',
  ads: 'Advertising',
  payment: 'Payments',
  default: 'Other',
}

function ConnectorCard({ connector, onConnect, onDisconnect }) {
  const Icon = categoryIcons[connector.category] || categoryIcons.default
  const healthColor = {
    up: 'text-green-500',
    degraded: 'text-amber-500',
    down: 'text-red-500',
    unknown: 'text-gray-400',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
            <Icon size={20} className="text-gray-600 dark:text-gray-300" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{connector.name}</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{categoryLabels[connector.category] || connector.category}</span>
          </div>
        </div>
        {connector.connected ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
            <CheckCircle size={16} /> Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <XCircle size={16} /> Not connected
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{connector.description || 'No description available.'}</p>
      {connector.connected && (
        <p className="text-xs text-green-700 dark:text-green-400 mb-3">Status: connected for your account — ready when you publish.</p>
      )}

      <div className="flex items-center gap-2 text-xs mb-4">
        <span className={`flex items-center gap-1 ${healthColor[connector.health?.status] || 'text-gray-400'}`}>
          {connector.health?.status === 'up' ? <CheckCircle size={12} /> : connector.health?.status === 'degraded' ? <AlertTriangle size={12} /> : <XCircle size={12} />}
          {connector.health?.status || 'unknown'}
        </span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="text-gray-500 dark:text-gray-400">{connector.operations?.length || 0} operations</span>
      </div>

      <div className="flex items-center gap-2">
        {connector.connected ? (
          <button
            onClick={() => onDisconnect(connector.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Unlink size={14} />
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => onConnect(connector.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
          >
            <Link2 size={14} />
            Connect
          </button>
        )}
        <button
          className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          onClick={() => window.open(connector.auth?.authorizationUrl, '_blank')}
        >
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  )
}

export default function Connectors() {
  const [connectors, setConnectors] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [banner, setBanner] = useState('')

  const fetchConnectors = async () => {
    try {
      setRefreshing(true)
      const res = await api.get('/connectors')
      setConnectors(res.data.connectors || [])
      setCategories(res.data.categories || [])
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load connectors')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchConnectors()
  }, [])

  const handleConnect = async (connectorId) => {
    setBanner('')
    try {
      const res = await api.get(`/connectors/${connectorId}/auth`)
      if (res.data.authorizationUrl) {
        window.location.href = res.data.authorizationUrl
        return
      }
      setBanner('This connector cannot start OAuth yet. Ask your admin to finish platform setup.')
    } catch (err) {
      const data = err.response?.data
      if (data?.needsConfig) {
        setBanner('This platform is not configured by your admin yet. You can browse connectors, but Connect stays unavailable until admin finishes setup — we will not fake a connection.')
      } else {
        setBanner(data?.error || 'Could not start the connection. Try again in a moment.')
      }
    }
  }

  const handleDisconnect = async (connectorId) => {
    setBanner('')
    try {
      await api.post(`/connectors/${connectorId}/revoke`)
      setBanner('Disconnected. Live publish for that platform is off until you connect again.')
      fetchConnectors()
    } catch (err) {
      setBanner(err.response?.data?.error || 'Could not disconnect right now.')
    }
  }

  const filtered = selectedCategory === 'all'
    ? connectors
    : connectors.filter(c => c.category === selectedCategory)

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
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Failed to load connectors</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Connectors</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage 100+ app integrations and OAuth connections</p>
        </div>
        <button
          onClick={fetchConnectors}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {banner && (
        <div className="p-3 rounded-lg text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
          {banner}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          >
            {cat.name} ({cat.count})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(connector => (
          <ConnectorCard
            key={connector.id}
            connector={connector}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          title="No connectors in this view"
          description="Pick another category, or open Social to connect priority platforms and generate posts."
          icon={Plug}
        />
      )}
    </div>
  )
}
