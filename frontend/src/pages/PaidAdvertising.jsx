import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, DollarSign, PauseCircle, PlayCircle, ShieldCheck } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

const dollars = (cents = 0) => (Number(cents || 0) / 100).toFixed(2)

export default function PaidAdvertising() {
  const { addToast } = useToast()
  const [budgets, setBudgets] = useState([])
  const [policy, setPolicy] = useState(null)
  const [provider, setProvider] = useState('meta')
  const [enabled, setEnabled] = useState(false)
  const [limit, setLimit] = useState(100)
  const [busy, setBusy] = useState(false)

  const feePct = useMemo(() => ((policy?.serviceFeeBps || 500) / 100).toFixed(1), [policy])
  const projectedFee = Math.max(0.5, limit * ((policy?.serviceFeeBps || 500) / 10000))
  const projectedMedia = Math.max(0, limit - projectedFee)

  const load = async () => {
    const res = await api.get('/paid-ads')
    setBudgets(Array.isArray(res.data?.budgets) ? res.data.budgets : [])
    setPolicy(res.data?.policy || null)
  }

  useEffect(() => { load().catch(() => {}) }, [])

  const createBudget = async () => {
    setBusy(true)
    try {
      const res = await api.post('/paid-ads', {
        provider,
        enabled,
        totalBudgetCents: Math.round(limit * 100),
      })
      setBudgets((prev) => [res.data, ...prev])
      addToast('Paid advertising budget created.', 'success')
    } catch (err) {
      addToast(err.response?.data?.error || 'Unable to create budget.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleBudget = async (budget) => {
    try {
      const res = await api.patch('/paid-ads/' + budget.id, { enabled: !budget.enabled })
      setBudgets((prev) => prev.map((item) => item.id === budget.id ? res.data : item))
    } catch (err) {
      addToast(err.response?.data?.error || 'Unable to update budget.', 'error')
    }
  }

  const payFee = async (budget) => {
    try {
      const res = await api.post('/paid-ads/' + budget.id + '/service-fee-checkout')
      if (res.data?.url) window.location.href = res.data.url
    } catch (err) {
      addToast(err.response?.data?.error || 'Unable to start service-fee checkout.', 'error')
    }
  }

  const activate = async (budget) => {
    try {
      const res = await api.post('/paid-ads/' + budget.id + '/activate')
      addToast(res.data?.message || 'Paid advertising controls armed.', 'success')
      await load()
    } catch (err) {
      addToast(err.response?.data?.error || 'Unable to activate paid advertising.', 'warning')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Paid Advertising Control</h2>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
          Set an all-in spend ceiling before any paid ad can run. TrillionAI keeps a small disclosed service fee and the remaining amount becomes the external media cap.
        </p>
      </div>

      <div className="p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold" style={{ color: 'var(--gold-bright)' }}>Paid advertising</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Nothing can activate while this switch is off.</div>
          </div>
          <button
            type="button"
            aria-pressed={enabled}
            onClick={() => setEnabled((v) => !v)}
            className="relative h-7 w-12 rounded-full"
            style={{ background: enabled ? 'var(--gold)' : 'var(--line)' }}
          >
            <span className={'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ' + (enabled ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>

        <div>
          <label className="text-sm" style={{ color: 'var(--text-muted)' }}>Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="block mt-1 px-3 py-2"
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--gold)' }}>
            <option value="meta">Meta / Facebook / Instagram Ads</option>
            <option value="google">Google Ads</option>
          </select>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            <span>Strict all-in spend limit</span>
            <strong style={{ color: 'var(--gold-bright)' }}>${limit.toFixed(0)} USD</strong>
          </div>
          <input type="range" min="10" max="5000" step="10" value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
            <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Your total limit</div>
              <div className="font-semibold">${limit.toFixed(2)}</div>
            </div>
            <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}>
              <div style={{ color: 'var(--text-muted)' }}>TrillionAI service fee ({feePct}%)</div>
              <div className="font-semibold">${projectedFee.toFixed(2)}</div>
            </div>
            <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Maximum external media spend</div>
              <div className="font-semibold">${projectedMedia.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm p-3 rounded-lg" style={{ background: 'rgba(196,163,90,0.08)', color: 'var(--text-muted)' }}>
          <ShieldCheck size={18} className="shrink-0" />
          <span>Strict hard stop is mandatory. TrillionAI will not enable a live provider unless the provider adapter can enforce budget caps and pause campaigns. Ads you run directly outside TrillionAI are outside this limit and must be paid by you separately.</span>
        </div>

        <button onClick={createBudget} disabled={busy} className="px-4 py-2 text-sm uppercase tracking-widest" style={{ background: 'var(--gold)', color: '#140f08' }}>
          {busy ? 'Saving…' : 'Create budget'}
        </button>
      </div>

      <div className="space-y-3">
        {budgets.map((budget) => (
          <div key={budget.id} className="p-5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <div className="font-semibold capitalize" style={{ color: 'var(--gold-bright)' }}>{budget.provider} paid ads</div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Total ${dollars(budget.totalBudgetCents)} · service fee ${dollars(budget.serviceFeeCents)} · media cap ${dollars(budget.mediaSpendCapCents)}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Remaining media budget: ${dollars(budget.remainingMediaBudgetCents)} · Status: {budget.status}
                </div>
              </div>
              <button onClick={() => toggleBudget(budget)} className="inline-flex items-center gap-2 text-sm">
                {budget.enabled ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                {budget.enabled ? 'Turn off' : 'Turn on'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {budget.enabled && !budget.serviceFeePaidAt && (
                <button onClick={() => payFee(budget)} className="px-3 py-2 text-sm rounded-lg" style={{ border: '1px solid var(--gold)', color: 'var(--gold-bright)' }}>
                  <DollarSign size={15} className="inline mr-1" /> Pay service fee
                </button>
              )}
              {budget.enabled && budget.serviceFeePaidAt && budget.status !== 'hard_stopped' && (
                <button onClick={() => activate(budget)} className="px-3 py-2 text-sm rounded-lg" style={{ border: '1px solid var(--cyan)', color: 'var(--cyan)' }}>
                  Activate managed ads
                </button>
              )}
              {budget.status === 'hard_stopped' && (
                <span className="inline-flex items-center gap-2 text-sm text-red-500">
                  <AlertTriangle size={16} /> Hard stopped because the spend limit was reached.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
