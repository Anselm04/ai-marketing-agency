import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api.js'
import { useToast } from '../context/ToastContext'
import {
  Link2, Plug, Unplug, CheckCircle, XCircle, RefreshCw, ExternalLink,
  Twitter, Linkedin, Instagram, Facebook, Youtube, MessageSquare, ShoppingCart,
  CreditCard, Mail, Users, Search, Target, FileText, BookOpen, Database,
  Calendar, Briefcase, Globe, Video, Image, ChevronRight, ArrowLeft,
  AlertTriangle, Sparkles, Zap, Shield, BarChart3
} from 'lucide-react'

const iconMap = {
  Twitter, Linkedin, Instagram, Facebook, Youtube, MessageSquare, ShoppingCart,
  CreditCard, Mail, Users, Search, Target, FileText, BookOpen, Database,
  Calendar, Briefcase, Globe, Video, Image, AlertTriangle, Sparkles, Zap, Shield, BarChart3
}

const categoryColors = {
  social: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ecommerce: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  ads: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  email: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  crm: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  productivity: 'bg-slate-50 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  content: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  video: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  payment: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  analytics: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

const categoryLabels = {
  social: 'Social Media',
  ecommerce: 'E-Commerce',
  ads: 'Advertising',
  email: 'Email Marketing',
  crm: 'CRM & Sales',
  productivity: 'Productivity',
  content: 'Content Management',
  video: 'Video',
  payment: 'Payments',
  analytics: 'Analytics',
}

export default function IntegrationHub() {
  const { showToast } = useToast()
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [configModal, setConfigModal] = useState(null)
  const [configValues, setConfigValues] = useState({})
  const [testing, setTesting] = useState(null)

  useEffect(() => {
    loadIntegrations()
  }, [])

  async function loadIntegrations() {
    try {
      setLoading(true)
      const res = await api.get('/integrations')
      setIntegrations(res.data.all || res.data.available || [])
    } catch (err) {
      showToast('Failed to load integrations', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function connect(integrationId, config) {
    try {
      await api.post(`/integrations/${integrationId}/connect`, config)
      showToast(`${integrationId} connected successfully`, 'success')
      loadIntegrations()
      setConfigModal(null)
      setConfigValues({})
    } catch (err) {
      showToast(err.response?.data?.error || 'Connection failed', 'error')
    }
  }

  async function disconnect(integrationId) {
    try {
      await api.post(`/integrations/${integrationId}/disconnect`)
      showToast(`${integrationId} disconnected`, 'success')
      loadIntegrations()
    } catch (err) {
      showToast('Disconnection failed', 'error')
    }
  }

  async function testConnection(integrationId) {
    try {
      setTesting(integrationId)
      const res = await api.post(`/integrations/${integrationId}/test`)
      if (res.data.connected) {
        showToast(`${integrationId} connection is healthy`, 'success')
      } else {
        showToast(`${integrationId} connection failed`, 'error')
      }
    } catch (err) {
      showToast('Test failed', 'error')
    } finally {
      setTesting(null)
    }
  }

  const categories = ['all', ...new Set(integrations.map(i => i.category))]
  const filtered = selectedCategory === 'all'
    ? integrations
    : integrations.filter(i => i.category === selectedCategory)

  const connectedCount = integrations.filter(i => i.connected).length

  const renderIcon = (iconName, className) => {
    const Icon = iconMap[iconName] || Link2
    return <Icon size={20} className={className} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Integration Hub</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Connect {integrations.length}+ apps to power your AI marketing engine
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {connectedCount} of {integrations.length} connected
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {categoryLabels[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Connected summary */}
      {connectedCount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {integrations.filter(i => i.connected).map(i => (
            <div key={i.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-2">
              {renderIcon(i.icon, 'text-green-500')}
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{i.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Integration grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))
        ) : (
          filtered.map(integration => {
            const isConnected = integration.connected
            return (
              <div
                key={integration.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border ${
                  isConnected
                    ? 'border-green-200 dark:border-green-900/50'
                    : 'border-gray-200 dark:border-gray-700'
                } p-5 transition-all hover:shadow-md`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${categoryColors[integration.category] || 'bg-gray-50'}`}>
                      {renderIcon(integration.icon, '')}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{integration.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[integration.category] || 'bg-gray-100'}`}>
                        {categoryLabels[integration.category] || integration.category}
                      </span>
                    </div>
                  </div>
                  {isConnected ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <XCircle size={18} className="text-gray-300 dark:text-gray-600" />
                  )}
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                  {integration.description}
                </p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {integration.capabilities?.slice(0, 3).map(cap => (
                    <span key={cap} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                      {cap}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => testConnection(integration.id)}
                        disabled={testing === integration.id}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <RefreshCw size={14} className={testing === integration.id ? 'animate-spin' : ''} />
                        Test
                      </button>
                      <button
                        onClick={() => disconnect(integration.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Unplug size={14} />
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setConfigModal(integration)
                        setConfigValues({})
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
                    >
                      <Plug size={14} />
                      Connect
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Config modal */}
      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 max-w-md w-full max-h-[80vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Connect {configModal.name}
              </h3>
              <button
                onClick={() => { setConfigModal(null); setConfigValues({}) }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {configModal.authType === 'oauth2' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400">
                  This integration uses OAuth 2.0. You will be redirected to authenticate.
                </div>
              )}
              {configModal.authType === 'webhook' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={configValues.webhookUrl || ''}
                    onChange={e => setConfigValues({ ...configValues, webhookUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    placeholder="https://hooks.example.com/..."
                  />
                </div>
              )}
              {configModal.authType === 'apikey' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={configValues.apiKey || ''}
                      onChange={e => setConfigValues({ ...configValues, apiKey: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                      placeholder="Enter your API key"
                    />
                  </div>
                  {['shopify', 'mailchimp', 'wordpress'].includes(configModal.id) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {configModal.id === 'shopify' ? 'Shop Domain' : configModal.id === 'mailchimp' ? 'Datacenter' : 'Site URL'}
                      </label>
                      <input
                        type="text"
                        value={configValues.shopDomain || configValues.url || configValues.datacenter || ''}
                        onChange={e => {
                          const key = configModal.id === 'shopify' ? 'shopDomain' : configModal.id === 'mailchimp' ? 'datacenter' : 'url'
                          setConfigValues({ ...configValues, [key]: e.target.value })
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                        placeholder={configModal.id === 'shopify' ? 'my-store.myshopify.com' : configModal.id === 'mailchimp' ? 'us1' : 'https://example.com'}
                      />
                    </div>
                  )}
                </>
              )}
              {configModal.authType === 'basic' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                    <input
                      type="text"
                      value={configValues.username || ''}
                      onChange={e => setConfigValues({ ...configValues, username: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password / App Password</label>
                    <input
                      type="password"
                      value={configValues.password || ''}
                      onChange={e => setConfigValues({ ...configValues, password: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    />
                  </div>
                  {configModal.id === 'wordpress' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site URL</label>
                      <input
                        type="url"
                        value={configValues.url || ''}
                        onChange={e => setConfigValues({ ...configValues, url: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                        placeholder="https://example.com"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setConfigModal(null); setConfigValues({}) }}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => connect(configModal.id, configValues)}
                className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
