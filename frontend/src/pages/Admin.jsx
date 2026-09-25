import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const SKU_LABELS = {
  starter: 'Starter $149/mo',
  growth: 'Growth $399/mo',
  agency: 'Agency $999/mo',
  enterprise: 'Enterprise $2499/mo',
  credits_100: '100 credits $79',
  credits_300: '300 credits $199',
  credits_750: '750 credits $449',
}

export default function Admin() {
  const { isOwner, user } = useAuth()
  const [tab, setTab] = useState('analytics')
  const [analytics, setAnalytics] = useState(null)
  const [codes, setCodes] = useState([])
  const [sku, setSku] = useState('starter')
  const [minted, setMinted] = useState(null)
  const [ownerCode, setOwnerCode] = useState('')
  const [ownerCodeMessage, setOwnerCodeMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isOwner) return
    api.get('/admin/analytics').then(res => setAnalytics(res.data)).catch(() => setError('Access denied'))
  }, [isOwner])

  useEffect(() => {
    if (!isOwner || tab !== 'codes') return
    api.get('/admin/god-codes').then(res => setCodes(res.data)).catch(() => {})
  }, [isOwner, tab, minted])

  const mint = async () => {
    setBusy(true)
    setError('')
    setMinted(null)
    try {
      const res = await api.post('/admin/god-codes', { sku })
      setMinted(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Mint failed')
    } finally {
      setBusy(false)
    }
  }

  const redeemOwnerCode = async (event) => {
    event.preventDefault()
    if (!ownerCode.trim()) return
    setBusy(true)
    setError('')
    setOwnerCodeMessage('')
    try {
      const res = await api.post('/admin/god-codes/redeem-owner', { code: ownerCode.trim() })
      setOwnerCodeMessage(res.data?.name ? 'Owner access granted: ' + res.data.name : 'Owner code redeemed')
      setOwnerCode('')
      const [analyticsRes, codesRes] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/admin/god-codes'),
      ])
      setAnalytics(analyticsRes.data)
      setCodes(codesRes.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to redeem owner code')
    } finally {
      setBusy(false)
    }
  }

  if (!isOwner) {
    return (
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Access denied</h2>
        <p style={{ color: 'var(--text-muted)' }}>Owner only.</p>
      </div>
    )
  }

  const counts = analytics?.counts || {}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Admin</h2>
        <p style={{ color: 'var(--text-muted)' }}>Signed in as {user?.email}. God codes test every Marketing tier without paying. Shown once. One-use. Bound to the redeemer.</p>
      </div>

      <div className="flex gap-2">
        {['analytics', 'codes'].map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)}
            className="px-4 py-2 text-sm tracking-widest uppercase"
            style={tab === item
              ? { background: 'var(--gold)', color: '#140f08' }
              : { border: '1px solid var(--line)', color: 'var(--gold-bright)' }}>
            {item}
          </button>
        ))}
      </div>

      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Users', counts.totalUsers],
              ['Signups 7d', counts.recentSignups7d],
              ['Active subs', counts.activeSubscriptions],
              ['Unused codes', counts.unusedCodes],
            ].map(([label, value]) => (
              <div key={label} className="p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--gold-bright)' }}>{value ?? 0}</div>
              </div>
            ))}
          </div>
          <h3 className="font-semibold" style={{ color: 'var(--gold-bright)' }}>Recent users</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--cyan)' }}>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Plan</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Credits</th>
                  <th className="text-left p-2">Grant</th>
                  <th className="text-left p-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.recentUsers || []).map((u) => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.plan}</td>
                    <td className="p-2">{u.status}</td>
                    <td className="p-2">{u.credits}</td>
                    <td className="p-2">{u.godGrant || '—'}</td>
                    <td className="p-2">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'codes' && (
        <div className="space-y-6">
          <form onSubmit={redeemOwnerCode} className="p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--cyan)' }}>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--gold-bright)' }}>Owner code entry</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                This control is available only inside your owner Admin dashboard while signed in as {user?.email}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={ownerCode}
                onChange={(event) => setOwnerCode(event.target.value.toUpperCase())}
                placeholder="TM-XXXX-XXXX-XXXX"
                autoComplete="off"
                spellCheck="false"
                className="flex-1 min-w-[16rem] px-3 py-2 font-mono text-sm"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--gold)' }}
              />
              <button
                type="submit"
                disabled={busy || !ownerCode.trim()}
                className="px-4 py-2 text-sm tracking-widest uppercase disabled:opacity-50"
                style={{ background: 'var(--cyan)', color: '#061014' }}
              >
                {busy ? 'Applying…' : 'Apply to my owner account'}
              </button>
            </div>
            {ownerCodeMessage && <p className="text-sm text-green-500">{ownerCodeMessage}</p>}
          </form>

          <div className="p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
            <h3 className="font-semibold" style={{ color: 'var(--gold-bright)' }}>Mint a one-use god code</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Pick the Marketing SKU to grant. The plaintext is shown once. It is hashed and encrypted on the server. Redeeming binds it to that user forever.</p>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-sm" style={{ color: 'var(--text-muted)' }}>
                SKU
                <select value={sku} onChange={(e) => setSku(e.target.value)} className="block mt-1 px-3 py-2"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--gold)' }}>
                  {Object.entries(SKU_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={mint} disabled={busy}
                className="px-4 py-2 text-sm tracking-widest uppercase"
                style={{ background: 'var(--gold)', color: '#140f08' }}>
                {busy ? 'Minting…' : 'Mint code'}
              </button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {minted?.code && (
              <div className="p-4" style={{ border: '1px solid var(--gold)' }}>
                <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--cyan)' }}>Shown once — copy now</div>
                <div className="text-2xl font-mono mt-2" style={{ color: 'var(--gold-bright)' }}>{minted.code}</div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{SKU_LABELS[minted.sku] || minted.sku}</div>
              </div>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--cyan)' }}>
                <th className="text-left p-2">SKU</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Created</th>
                <th className="text-left p-2">Redeemed</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td className="p-2">{SKU_LABELS[c.sku] || c.sku}</td>
                  <td className="p-2">{c.status}</td>
                  <td className="p-2">{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</td>
                  <td className="p-2">{c.redeemedAt ? new Date(c.redeemedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
