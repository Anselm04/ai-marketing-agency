import { useEffect, useState } from 'react'
import api from '../services/api'
import { ORGANIC_NETWORKS } from '../config/organic'
import { needsConfigMessage, friendlyPublishMessage, socialBadgeFor as badgeFor } from '../utils/customerCopy'
import SocialView from './SocialView.jsx'

const PRIORITY_IDS = ['x', 'tiktok', 'instagram', 'facebook', 'linkedin', 'youtube', 'meta', 'google']

export default function SocialInner() {

  const [platforms, setPlatforms] = useState([])
  const [oauthStatus, setOauthStatus] = useState([])
  const [posts, setPosts] = useState([])
  const [types, setTypes] = useState([])
  const [brief, setBrief] = useState({ product: '', audience: '', description: '', contentType: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState('')
  const [tokenDraft, setTokenDraft] = useState({})
  const [busyPlat, setBusyPlat] = useState('')

  const refresh = async () => {
    const [st, po, ty, oa] = await Promise.all([
      api.get('/social/status'),
      api.get('/social/posts'),
      api.get('/content/types').catch(() => ({ data: { platforms: [] } })),
      api.get('/social/oauth/status').catch(() => ({ data: { platforms: [] } })),
    ])
    setPlatforms(st.data || [])
    setPosts(po.data || [])
    setTypes(ty.data?.platforms || [])
    setOauthStatus(oa.data?.platforms || [])
  }

  useEffect(() => {
    refresh().catch(() => {})
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const oauthError = params.get('oauth_error')
    if (connected) {
      setMsg(`${connected} is connected. Status: ready to publish for this account only — tokens are not shared.`)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (oauthError) {
      setMsg(`OAuth failed: ${oauthError}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const organic = platforms.filter((p) => p.organic)
  const shown = organic.length ? organic : ORGANIC_NETWORKS.map((n) => ({ platform: n.id, name: n.name, organic: true, setup: false, connected: false }))
  const oauthByPlat = Object.fromEntries(oauthStatus.map((o) => [o.platform, o]))

  const priorityShown = [
    ...PRIORITY_IDS.map((id) => {
      const oa = oauthByPlat[id]
      const fromStatus = shown.find((p) => p.platform === id)
      return {
        platform: id,
        name: oa?.label || fromStatus?.name || id,
        organic: oa?.kind !== 'ads',
        setup: !!(fromStatus?.setup || oa?.setup),
        connected: !!(oa?.connected || fromStatus?.connected),
        oauthConfigured: !!oa?.oauthConfigured,
        connectorId: oa?.connectorId,
        setupHint: oa?.setupHint,
        priority: true,
      }
    }),
    ...shown.filter((p) => !PRIORITY_IDS.includes(p.platform)),
  ]

  const startOAuth = async (plat) => {
    setBusyPlat(plat)
    setMsg('')
    try {
      const res = await api.get(`/social/oauth/${plat}/start`)
      const url = res.data?.authorizationUrl
      if (!url) {
        setMsg(res.data?.error || 'No authorization URL returned')
        return
      }
      window.location.href = url
    } catch (err) {
      const data = err.response?.data
      if (data?.needsConfig) {
        setMsg(needsConfigMessage(data.platform || plat))
      } else {
        setMsg(data?.error || err.message || 'Could not start OAuth. Try again in a moment.')
      }
    } finally {
      setBusyPlat('')
    }
  }

  const connectSetup = async (plat) => {
    await api.post('/social/connect', { platform: plat })
    await refresh()
    setMsg(`${plat} marked for setup. Organic is included. Add a token or OAuth credentials to publish.`)
  }

  const connectWithToken = async (plat) => {
    const token = (tokenDraft[plat] || '').trim()
    if (!token) {
      setMsg('Paste an access token first, or use OAuth when credentials are configured.')
      return
    }
    await api.post('/social/connect', { platform: plat, token })
    setTokenDraft((d) => ({ ...d, [plat]: '' }))
    await refresh()
    setMsg(`${plat} token stored for this account. Value is not returned.`)
  }

  const onConnectClick = async (p) => {
    if (p.oauthConfigured) {
      await startOAuth(p.platform)
      return
    }
    await connectSetup(p.platform)
  }

  const generate = async (e) => {
    e.preventDefault()
    if (!brief.product.trim() && !brief.description.trim()) {
      setMsg('Describe the product and audience first.')
      return
    }
    setLoading(true)
    setMsg('')
    try {
      const res = await api.post('/social/generate', brief)
      setPosts(res.data.posts || [])
      const keyNote = res.data.missingKey ? ` Templates used — missing ${res.data.missingKey}.` : ''
      setMsg((res.data.disclaimer || `Generated ${res.data.uniqueBodies} unique native posts. Not published.`) + keyNote)
      await refresh()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Could not generate')
    } finally {
      setLoading(false)
    }
  }

  const copyText = async (text, id) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 1200)
  }

  const queue = async (id) => {
    try {
      const res = await api.post('/social/queue', { id })
      setMsg(res.data?.message || 'Added to your queue. Nothing goes live until a platform is connected.')
    } catch (err) {
      setMsg(err.response?.data?.error || 'Could not queue that post.')
    }
    await refresh()
  }

  const publishOne = async (id) => {
    try {
      const res = await api.post(`/social/posts/${id}/publish`)
      setMsg(friendlyPublishMessage(res.data))
    } catch (err) {
      const data = err.response?.data
      if (data?.needsConfig) setMsg(needsConfigMessage(data.platform))
      else setMsg(friendlyPublishMessage(data) || err.message || 'Publish failed')
    }
    await refresh()
  }

  const typeOptions = types.flatMap((p) => (p.types || []).map((t) => ({ ...t, platform: p.id, platformName: p.name })))


  return (
    <SocialView
      priorityShown={priorityShown}
      oauthByPlat={oauthByPlat}
      badgeFor={badgeFor}
      busyPlat={busyPlat}
      onConnectClick={onConnectClick}
      tokenDraft={tokenDraft}
      setTokenDraft={setTokenDraft}
      connectWithToken={connectWithToken}
      brief={brief}
      setBrief={setBrief}
      generate={generate}
      loading={loading}
      typeOptions={typeOptions}
      msg={msg}
      posts={posts}
      copyText={copyText}
      copied={copied}
      queue={queue}
      publishOne={publishOne}
    />
  )
}
