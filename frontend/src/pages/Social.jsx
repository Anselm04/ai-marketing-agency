import { useEffect, useState } from 'react'
import { Share2, Send } from 'lucide-react'
import api from '../services/api'
import { ORGANIC_NETWORKS, ORGANIC_LABELS } from '../config/organic'

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm bg-[#0a0c11] border border-[#c4a35a]/40 text-[#efeae0] focus:outline-none focus:ring-1 focus:ring-[#c4a35a]'

const PRIORITY_IDS = ['x', 'tiktok', 'instagram', 'facebook', 'linkedin', 'youtube', 'meta', 'google']

function badgeFor(oauthRow, plat) {
  if (oauthRow?.connected || plat?.connected) return { text: 'Connected', color: 'var(--cyan)' }
  if (oauthRow?.oauthConfigured) return { text: 'OAuth ready', color: '#7dcea0' }
  if (oauthRow) return { text: 'Needs app credentials', color: '#e6b567' }
  if (plat?.setup) return { text: 'Set up — needs token', color: 'var(--text-dim)' }
  return { text: 'Set up (included)', color: 'var(--text-dim)' }
}

export default function Social() {
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
      setMsg(`Connected ${connected} via OAuth. Token stored for this account — not shared.`)
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
        envKeys: oa?.envKeys,
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
        setMsg(`${plat}: needs app credentials — set ${ (data.envKeys || []).join(', ') || 'client id/secret' } on Fly. Paste a token below if you already have one.`)
      } else {
        setMsg(data?.error || err.message || 'Could not start OAuth')
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
    await api.post('/social/queue', { id })
    await refresh()
  }

  const publishOne = async (id) => {
    const res = await api.post(`/social/posts/${id}/publish`)
    setMsg(res.data?.message || (res.data?.published ? 'Published' : 'Queued — no token yet'))
    await refresh()
  }

  const typeOptions = types.flatMap((p) => (p.types || []).map((t) => ({ ...t, platform: p.id, platformName: p.name })))

  return (
    <div className="space-y-6" data-organic-network="20-platforms">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Organic social (included)</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          20 networks on your plan: {ORGANIC_LABELS}.
          Priority platforms support real per-user OAuth when app credentials are set on the server.
          Until then we stay honest: Needs app credentials / optional token paste — never fake Connected.
          Paid Meta/Google ads are an add-on with a spend cap.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {priorityShown.map((p) => {
          const badge = badgeFor(oauthByPlat[p.platform], p)
          const showTokenPaste = PRIORITY_IDS.includes(p.platform) && !p.oauthConfigured && !p.connected
          return (
            <div key={p.platform} className="rounded-lg p-3 text-sm space-y-2"
              style={{ background: 'var(--bg-card)', border: `1px solid ${p.connected ? '#c4a35a' : 'var(--line)'}`, color: 'var(--text)' }}>
              <div className="font-medium" style={{ color: 'var(--gold-bright)' }}>{p.name || p.platform}</div>
              <div className="text-[11px] uppercase tracking-wide" style={{ color: badge.color }}>{badge.text}</div>
              {p.setupHint && !p.oauthConfigured && !p.connected && (
                <p className="text-[10px] leading-snug" style={{ color: 'var(--text-dim)' }}>{p.setupHint}</p>
              )}
              <button type="button" disabled={busyPlat === p.platform}
                onClick={() => onConnectClick(p)}
                className="w-full px-2 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                style={{ background: p.oauthConfigured ? '#c4a35a' : 'transparent', color: p.oauthConfigured ? '#07080b' : 'var(--gold)', border: '1px solid #c4a35a' }}>
                {busyPlat === p.platform ? 'Starting…' : p.connected ? 'Reconnect' : p.oauthConfigured ? 'Connect with OAuth' : 'Mark set up'}
              </button>
              {showTokenPaste && (
                <div className="space-y-1">
                  <input
                    className={inputCls}
                    type="password"
                    placeholder="Optional: paste access token"
                    value={tokenDraft[p.platform] || ''}
                    onChange={(e) => setTokenDraft((d) => ({ ...d, [p.platform]: e.target.value }))}
                  />
                  <button type="button" onClick={() => connectWithToken(p.platform)}
                    className="text-[11px]" style={{ color: 'var(--cyan)' }}>
                    Save token for this account
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <form onSubmit={generate} className="rounded-lg p-5 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
        <h3 className="font-semibold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Generate native posts</h3>
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Each network gets its own body. We will not blast one caption to all 20.</p>
        <input className={inputCls} placeholder="Product" value={brief.product} onChange={(e) => setBrief({ ...brief, product: e.target.value })} />
        <input className={inputCls} placeholder="Audience" value={brief.audience} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} />
        <textarea className={inputCls + ' min-h-[90px]'} placeholder="Brief — what it is, who it is for, what it must not claim" value={brief.description} onChange={(e) => setBrief({ ...brief, description: e.target.value })} />
        <select className={inputCls} value={brief.contentType} onChange={(e) => setBrief({ ...brief, contentType: e.target.value })}>
          <option value="">Pre-made content type (optional)</option>
          {typeOptions.map((t) => (
            <option key={`${t.platform}-${t.id}`} value={t.id}>{t.platformName}: {t.name}</option>
          ))}
        </select>
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: '#c4a35a', color: '#07080b' }}>
          <Share2 size={16} /> {loading ? 'Writing native posts…' : 'Generate 20-network posts'}
        </button>
      </form>

      {msg && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{msg}</p>}

      <div className="space-y-3">
        {posts.map((p) => (
          <article key={p.id} className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-widest" style={{ color: 'var(--cyan)' }}>
              <span>{p.platformName || p.platform} · {p.contentType || 'native'} · {p.status || 'draft'} · {p.published ? 'live' : 'not published'}</span>
              <div className="flex gap-3">
                <button type="button" onClick={() => copyText(p.body, p.id)} style={{ color: 'var(--gold)' }}>{copied === p.id ? 'Copied' : 'Copy'}</button>
                <button type="button" onClick={() => queue(p.id)} style={{ color: 'var(--gold)' }}>Queue</button>
                <button type="button" onClick={() => publishOne(p.id)} style={{ color: 'var(--gold)' }} className="inline-flex items-center gap-1"><Send size={12} /> Publish if token</button>
              </div>
            </div>
            <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{p.body}</p>
          </article>
        ))}
        {!posts.length && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No drafts yet. Generate from your brief. Posts stay private to you.</p>
        )}
      </div>
    </div>
  )
}
