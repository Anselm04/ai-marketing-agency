import { Share2, Send } from 'lucide-react'
import { customerSetupHint } from '../utils/customerCopy'
import { ORGANIC_LABELS } from '../config/organic'

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm bg-[#0a0c11] border border-[#c4a35a]/40 text-[#efeae0] focus:outline-none focus:ring-1 focus:ring-[#c4a35a]'
const PRIORITY_IDS = ['x', 'tiktok', 'instagram', 'facebook', 'linkedin', 'youtube', 'meta', 'google']

export default function SocialView({
  priorityShown, busyPlat, onConnectClick, tokenDraft, setTokenDraft, connectWithToken,
  brief, setBrief, generate, loading, typeOptions, msg, posts, copyText, copied, queue, publishOne, badgeFor, oauthByPlat,
}) {
  return (
    <div className="space-y-6" data-organic-network="20-platforms">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Organic social (included)</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          20 networks on your plan: {ORGANIC_LABELS}.
          Priority platforms support real per-user OAuth when app credentials are set on the server.
          Until then we stay honest: connect when ready, or paste a token — we never fake Connected.
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
              {!p.connected && (
                <p className="text-[10px] leading-snug" style={{ color: 'var(--text-dim)' }}>{customerSetupHint(p)}</p>
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
          <p className="text-sm rounded-lg p-4" style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
            No drafts yet — describe your product above and generate native posts. Nothing is published until you connect a platform or copy-paste yourself.
          </p>
        )}
      </div>
    </div>
  )

}
