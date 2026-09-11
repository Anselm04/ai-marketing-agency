import { useEffect, useState } from 'react'
import { Share2, Send } from 'lucide-react'
import api from '../services/api'
import { ORGANIC_NETWORKS, ORGANIC_LABELS } from '../config/organic'

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm bg-[#0a0c11] border border-[#c4a35a]/40 text-[#efeae0] focus:outline-none focus:ring-1 focus:ring-[#c4a35a]'

export default function Social() {
  const [platforms, setPlatforms] = useState([])
  const [posts, setPosts] = useState([])
  const [types, setTypes] = useState([])
  const [brief, setBrief] = useState({ product: '', audience: '', description: '', contentType: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState('')

  const refresh = async () => {
    const [st, po, ty] = await Promise.all([
      api.get('/social/status'),
      api.get('/social/posts'),
      api.get('/content/types').catch(() => ({ data: { platforms: [] } })),
    ])
    setPlatforms(st.data || [])
    setPosts(po.data || [])
    setTypes(ty.data?.platforms || [])
  }

  useEffect(() => { refresh().catch(() => {}) }, [])

  const organic = platforms.filter((p) => p.organic)
  const shown = organic.length ? organic : ORGANIC_NETWORKS.map((n) => ({ platform: n.id, name: n.name, organic: true, setup: false, connected: false }))

  const connect = async (plat) => {
    await api.post('/social/connect', { platform: plat })
    await refresh()
    setMsg(`${plat} set up. Organic is included. Add a token later to publish.`)
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
          Connect, pick a pre-made content type, then one-click generate / queue / publish.
          Platform-specific posts — never an identical blast. Paid Meta/Google ads are an add-on with a spend cap.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {shown.map((p) => (
          <button key={p.platform} type="button" onClick={() => connect(p.platform)}
            className="text-left p-3 rounded-lg text-sm"
            style={{ background: 'var(--bg-card)', border: `1px solid ${p.setup || p.connected ? '#c4a35a' : 'var(--line)'}`, color: 'var(--text)' }}>
            <div className="font-medium" style={{ color: 'var(--gold-bright)' }}>{p.name || p.platform}</div>
            <div className="text-[11px]" style={{ color: p.connected ? 'var(--cyan)' : 'var(--text-dim)' }}>
              {p.connected ? 'Token on file' : p.setup ? 'Set up — needs token' : 'Set up (included)'}
            </div>
          </button>
        ))}
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
