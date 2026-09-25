import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { SkeletonCard } from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'
import {
  AlertTriangle, CheckCircle, ExternalLink, Film, Link2, Plug, RefreshCw, Unlink, XCircle
} from 'lucide-react'

const VIDEO_CATEGORY_LABELS = {
  major: 'Major platforms',
  short_form: 'Short-form',
  live: 'Live & video',
  messaging: 'Messaging',
  niche: 'Creator & niche',
  regional: 'Regional',
  decentralized: 'Decentralized',
}

const CAPABILITY_LABELS = {
  direct_api: 'Direct video upload',
  adapter_pending: 'Connection available / upload adapter pending',
  restricted_api: 'Provider approval or restricted API',
  messaging_only: 'Video messaging only',
  stream_only: 'Live streaming only',
  stream_or_vod_tools: 'Streaming / VOD tools',
  link_or_instance_specific: 'Instance-specific',
  no_public_upload_api: 'No public upload API',
  no_verified_public_upload_api: 'No verified public upload API',
  no_public_publish_api: 'No public publishing API',
  no_public_video_upload_api: 'No public video upload API',
}

function capabilityClass(platform) {
  if (platform.directPublishingReady) return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
  if (platform.connectable) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
}

function VideoPlatformCard({ platform, onConnect, onDisconnect }) {
  const connectorId = platform.connectorId
  const buttonDisabled = !platform.connectable || !connectorId

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <Film size={19} className="text-gray-600 dark:text-gray-300" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{platform.name}</h3>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {VIDEO_CATEGORY_LABELS[platform.category] || platform.category}
            </div>
          </div>
        </div>
        {platform.connected
          ? <CheckCircle size={18} className="text-green-500 flex-none" />
          : <XCircle size={18} className="text-gray-300 dark:text-gray-600 flex-none" />}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`text-[11px] px-2 py-1 rounded-full border ${capabilityClass(platform)}`}>
          {CAPABILITY_LABELS[platform.publish] || platform.publish}
        </span>
        {platform.connected && (
          <span className="text-[11px] px-2 py-1 rounded-full border bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
            Your account connected
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 min-h-[32px]">
        {platform.note || (
          platform.directPublishingReady
            ? 'Users authorize their own account. Videos publish with that user’s credentials.'
            : 'Listed so users can see the platform, but automated upload is only enabled when the provider exposes an approved API.'
        )}
      </p>

      {platform.connectorId && !platform.configured && platform.authType === 'oauth2' && (
        <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
          App OAuth credentials still need to be configured by TrillionAI before users can sign in.
        </div>
      )}

      <div className="mt-auto">
        {platform.connected ? (
          <button
            onClick={() => onDisconnect(connectorId)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Unlink size={14} />
            Disconnect my account
          </button>
        ) : (
          <button
            onClick={() => onConnect(connectorId)}
            disabled={buttonDisabled}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          >
            <Link2 size={14} />
            {platform.connectable ? 'Connect my account' : 'Connection not available'}
          </button>
        )}
      </div>
    </div>
  )
}

function ConnectorCard({ connector, onConnect, onDisconnect }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{connector.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{connector.category}</p>
        </div>
        {connector.connected
          ? <CheckCircle size={18} className="text-green-500" />
          : <XCircle size={18} className="text-gray-300 dark:text-gray-600" />}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{connector.description}</p>
      {connector.connected ? (
        <button onClick={() => onDisconnect(connector.id)} className="w-full px-3 py-2 border border-red-200 text-red-600 text-xs rounded-lg">
          Disconnect
        </button>
      ) : connector.authType === 'oauth2' ? (
        <button onClick={() => onConnect(connector.id)} className="w-full px-3 py-2 bg-blue-600 text-white text-xs rounded-lg">
          Connect
        </button>
      ) : (
        <div className="text-xs text-gray-500">Configured by API key or service credentials.</div>
      )}
    </div>
  )
}

export default function Connectors() {
  const [connectors, setConnectors] = useState([])
  const [videoPlatforms, setVideoPlatforms] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [view, setView] = useState('video')
  const [videoCategory, setVideoCategory] = useState('all')

  const fetchData = async () => {
    try {
      setRefreshing(true)
      const [connectorRes, videoRes] = await Promise.all([
        api.get('/connectors'),
        api.get('/connectors/video-platforms'),
      ])
      setConnectors(connectorRes.data.connectors || [])
      setVideoPlatforms(videoRes.data.platforms || [])
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load account connections')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connector_connected')
    const connectorError = params.get('connector_error')
    if (connected) setNotice(`${connected} connected successfully. Videos will use your own authorized account.`)
    if (connectorError) setError(connectorError)
    fetchData()
  }, [])

  const handleConnect = async (connectorId) => {
    if (!connectorId) return
    try {
      const res = await api.get(`/connectors/${connectorId}/auth`)
      if (!res.data.authorizationUrl) throw new Error('Authorization URL was not returned')
      window.location.assign(res.data.authorizationUrl)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to start account connection')
    }
  }

  const handleDisconnect = async (connectorId) => {
    if (!connectorId) return
    try {
      await api.post(`/connectors/${connectorId}/revoke`)
      setNotice('Account disconnected.')
      await fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect account')
    }
  }

  const categories = useMemo(
    () => [...new Set(videoPlatforms.map((platform) => platform.category))],
    [videoPlatforms],
  )
  const filteredVideo = videoCategory === 'all'
    ? videoPlatforms
    : videoPlatforms.filter((platform) => platform.category === videoCategory)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, index) => <SkeletonCard key={index} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Account Connections</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Each user signs in to their own social account. TrillionAI stores encrypted authorization tokens and never publishes through another user’s account.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          <CheckCircle size={16} /> {notice}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setView('video')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'video' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
        >
          Video Platforms ({videoPlatforms.length})
        </button>
        <button
          onClick={() => setView('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
        >
          All Integrations
        </button>
      </div>

      {view === 'video' ? (
        <>
          <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4 text-sm text-blue-800 dark:text-blue-200">
            <strong>Connection availability follows each platform’s official developer access.</strong> Platforms without an approved third-party upload API remain visible, but the app will not fake an automated login or upload.
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setVideoCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs ${videoCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setVideoCategory(category)}
                className={`px-3 py-1.5 rounded-full text-xs ${videoCategory === category ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
              >
                {VIDEO_CATEGORY_LABELS[category] || category}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredVideo.map((platform) => (
              <VideoPlatformCard
                key={platform.id}
                platform={platform}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
            ))}
          </div>

          {filteredVideo.length === 0 && (
            <EmptyState title="No video platforms found" description="No platforms match this filter." icon={Film} />
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {connectors.map((connector) => (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          ))}
          {connectors.length === 0 && (
            <EmptyState title="No integrations found" description="No integrations are currently registered." icon={Plug} />
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <ExternalLink size={13} />
        OAuth permission and public-posting approval are controlled by each platform provider.
      </div>
    </div>
  )
}
