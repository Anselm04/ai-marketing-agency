import { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'
import { Copy, Check } from 'lucide-react'

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    api.get('/campaigns').then((res) => {
      setCampaigns(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const openCampaign = async (id) => {
    setOpenId(id)
    const v = await api.get(`/campaigns/${id}/versions`)
    setDetail(v.data)
  }

  const copyText = async (text, key) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>It&apos;s running</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Master campaigns and native posts. Copy to paste if a token is missing.
        </p>
      </div>
      <Link to="/dashboard" className="mkt-btn mkt-btn-gold inline-flex">Start campaign</Link>
      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="text-sm rounded-lg p-4" style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
          No campaigns yet — open Start campaign on the dashboard to generate your first native posts.
        </div>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
              <button type="button" className="w-full text-left mkt-btn" style={{ background: 'transparent', border: 0, color: 'inherit', justifyContent: 'flex-start' }} onClick={() => openCampaign(c.id)}>
                <div>
                  <h3 className="font-medium" style={{ color: 'var(--text)' }}>{c.name}</h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{c.status} · {c.productName || 'campaign'} · {c.audienceLabel || c.targetAudience || ''}</p>
                </div>
              </button>
              {openId === c.id && detail && (
                <div className="mt-4 space-y-3">
                  {(detail.versions || []).map((p) => (
                    <article key={p.id} className="p-3 rounded" style={{ border: '1px solid var(--line)' }}>
                      <div className="flex flex-wrap justify-between gap-2 text-xs uppercase tracking-widest" style={{ color: 'var(--cyan)' }}>
                        <span>{p.platformName || p.platform} · {p.status}</span>
                        <button type="button" onClick={() => copyText(p.body, p.id)} className="mkt-btn" style={{ color: 'var(--gold)', background: 'transparent', border: '1px solid var(--line)' }}>
                          {copied === p.id ? <Check size={16} /> : <Copy size={16} />}
                          {copied === p.id ? 'Copied' : 'Copy post'}
                        </button>
                      </div>
                      <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{p.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
