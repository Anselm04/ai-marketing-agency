import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, Sparkles, Play } from 'lucide-react'
import api from '../services/api'
import { PRODUCT_PRESETS, AUDIENCE_PRESETS, DEFAULT_ORGANIC_COUNT } from '../config/presets'
import { ORGANIC_NETWORKS } from '../config/organic'

const inputCls = 'w-full px-4 py-3 rounded-lg text-base bg-[#0a0c11] border border-[#c4a35a]/40 text-[#efeae0] focus:outline-none focus:ring-1 focus:ring-[#c4a35a] min-h-[52px]'

export default function Dashboard() {
  const [url, setUrl] = useState('')
  const [productId, setProductId] = useState('appforge')
  const [audiencePreset, setAudiencePreset] = useState('consumers')
  const [paidAds, setPaidAds] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [run, setRun] = useState(null)
  const [copied, setCopied] = useState('')

  const copyText = async (text, key) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  const startCampaign = async () => {
    const picked = PRODUCT_PRESETS.find((p) => p.id === productId)
    const pasted = url.trim()
    if (!pasted && !picked) {
      setError('Paste a URL or pick a product.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/campaigns/start', {
        productId: pasted ? undefined : productId,
        url: pasted || picked?.url,
        product: pasted ? undefined : picked?.name,
        audiencePreset,
        paidAds,
      })
      setRun(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start campaign')
    } finally {
      setLoading(false)
    }
  }

  if (run?.running) {
    const posts = run.copyPaste || run.versions || []
    return (
      <div className="space-y-8 max-w-3xl">
        <div>
          <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--cyan)' }}>TrillionAI Marketing</p>
          <h1 className="text-3xl font-bold mt-2" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>
            It&apos;s running
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Master campaign for {run.campaign?.productName || 'your product'} · {run.audienceLabel || 'Consumers'} · {run.organicNetworks || DEFAULT_ORGANIC_COUNT} organic networks.
            {run.paidAds?.enabled ? ' Paid Meta+Google reserved under your slider.' : ' Paid Meta+Google off.'}
          </p>
        </div>
        {run.avatar && (
          <div className="rounded-lg p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
            <h2 className="text-xl" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Buyer avatar (auto)</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{run.avatar.summary}</p>
          </div>
        )}
        <div className="rounded-lg p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
          <h2 className="text-xl" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Copy to paste if tokens missing</h2>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            Organic is queued. If a network has no token, copy the native post and paste it there. No identical spam — each body is unique.
          </p>
          <div className="space-y-3">
            {posts.map((p) => (
              <article key={p.platform || p.id} className="rounded-lg p-4" style={{ border: '1px solid var(--line)' }}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--cyan)' }}>{p.platformName || p.platform}</span>
                  <button
                    type="button"
                    onClick={() => copyText(p.body, p.platform || p.id)}
                    className="mkt-btn inline-flex items-center gap-2 text-sm"
                    style={{ color: 'var(--gold)', background: 'transparent', border: '1px solid var(--line)' }}
                  >
                    {copied === (p.platform || p.id) ? <Check size={16} /> : <Copy size={16} />}
                    {copied === (p.platform || p.id) ? 'Copied' : 'Copy post'}
                  </button>
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{p.body}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => { setRun(null); setError('') }}
            className="mkt-btn mkt-btn-gold inline-flex items-center justify-center gap-2"
          >
            Start another
          </button>
          <Link to="/dashboard/advanced" className="mkt-btn mkt-btn-ghost inline-flex items-center justify-center">Advanced</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--cyan)' }}>TrillionAI Marketing</p>
        <h1 className="text-3xl font-bold mt-2" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>
          Start campaign
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Four steps. Presets. One click. It runs.
        </p>
      </div>

      <section className="rounded-lg p-6 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
        <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--cyan)' }}>1</p>
        <h2 className="text-2xl" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>What are we marketing?</h2>
        <label className="block text-sm" style={{ color: 'var(--text-muted)' }}>
          Paste a URL
          <input
            className={inputCls + ' mt-2'}
            placeholder="https://your-product.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>or pick AppForge / Marketing / Skyline Invaders / a library product</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="list">
          {PRODUCT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setProductId(p.id); setUrl('') }}
              className="mkt-btn text-left min-h-[48px]"
              style={productId === p.id && !url
                ? { background: 'rgba(196,163,90,0.18)', color: 'var(--gold-bright)', border: '1px solid var(--gold)' }
                : { background: 'transparent', color: 'var(--text)', border: '1px solid var(--line)' }}
            >
              <span className="block font-medium">{p.name}</span>
              <span className="block text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{p.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section
        className="rounded-lg p-6 space-y-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}
        data-audience-presets="consumers,business,developers"
      >
        <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--cyan)' }}>2</p>
        <h2 className="text-2xl" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Who?</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>3 presets only. Auto buyer avatar.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AUDIENCE_PRESETS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAudiencePreset(a.id)}
              className="mkt-btn text-left min-h-[48px]"
              data-audience-preset={a.id}
              style={audiencePreset === a.id
                ? { background: 'rgba(196,163,90,0.18)', color: 'var(--gold-bright)', border: '1px solid var(--gold)' }
                : { background: 'transparent', color: 'var(--text)', border: '1px solid var(--line)' }}
            >
              <span className="block font-medium">{a.label}</span>
              <span className="block text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{a.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section
        className="rounded-lg p-6 space-y-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}
        data-organic-network="20-platforms"
        data-organic-default="all-20"
      >
        <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--cyan)' }}>3</p>
        <h2 className="text-2xl" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Where?</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Default: All 20 organic networks. 20-platform organic included. Paid Google/Meta extra.
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {ORGANIC_NETWORKS.map((n) => n.name).join(' · ')}
        </p>
        <label className="flex items-start gap-3 text-sm" style={{ color: 'var(--text)' }} data-paid-ads-default="off">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={paidAds}
            onChange={(e) => setPaidAds(e.target.checked)}
          />
          <span>
            Add paid Meta+Google
            <span className="block text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
              Off by default. Extra, still capped by your slider ($10 / $100 safe default).
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-lg p-6 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
        <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--cyan)' }}>4</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="button"
          data-start-campaign="Start campaign"
          onClick={startCampaign}
          disabled={loading}
          className="mkt-btn mkt-btn-gold mkt-btn-start min-h-[52px] w-full inline-flex items-center justify-center gap-3 text-base disabled:opacity-50"
          style={{ minHeight: 52, padding: '0.95rem 1.6rem' }}
        >
          {loading ? <Sparkles size={20} /> : <Play size={20} />}
          {loading ? 'Starting…' : 'Start campaign'}
        </button>
        <Link to="/dashboard/advanced" className="block text-sm" style={{ color: 'var(--gold)' }}>
          Advanced — spend slider, per-network, video studio
        </Link>
      </section>
    </div>
  )
}
