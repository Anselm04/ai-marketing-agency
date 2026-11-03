import { useMemo, useState } from 'react'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

function major(budget, field) {
  const exponent = Number.isInteger(budget?.currencyExponent) ? budget.currencyExponent : 2
  return Number(budget?.[field] || 0) / (10 ** exponent)
}

function money(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value || 0))
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`
  }
}

const MODES = [
  {
    id: 'manual',
    title: 'Manual',
    text: 'TrillionAI prepares and recommends. You approve launches and material changes.',
  },
  {
    id: 'bounded_auto',
    title: 'Automatic within my limits',
    text: 'TrillionAI may launch, pause and optimise inside the exact caps you approve here.',
  },
  {
    id: 'full_auto',
    title: 'Fully automated within my cap',
    text: 'TrillionAI runs the campaign autonomously, but can never exceed your approved spending envelope.',
  },
]

export default function PaidAdAuthorizationPanel({ budget, onAuthorized }) {
  const { addToast } = useToast()
  const currency = budget.currency || budget.providerAccount?.currency || 'USD'
  const total = major(budget, 'totalBudgetCents')
  const mediaCap = major(budget, 'mediaSpendCapCents')
  const fee = major(budget, 'serviceFeeCents')
  const existingDaily = major({ ...budget, daily: budget.spendAuthorization?.dailyMediaSpendCapCents }, 'daily')
  const [mode, setMode] = useState(budget.spendAuthorization?.mode || 'bounded_auto')
  const [dailyCap, setDailyCap] = useState(existingDaily > 0 ? existingDaily : Math.max(1, Math.min(mediaCap, Math.ceil(mediaCap / 10))))
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)

  const step = useMemo(() => {
    if (mediaCap <= 20) return 1
    if (mediaCap <= 200) return 5
    if (mediaCap <= 2000) return 10
    return 50
  }, [mediaCap])

  const authorize = async () => {
    if (!accepted) {
      addToast('Confirm that you understand and authorize the displayed maximum costs.', 'warning')
      return
    }
    if (!password) {
      addToast('Re-enter your account password before authorizing paid advertising.', 'warning')
      return
    }
    setBusy(true)
    try {
      const res = await api.post(`/paid-ads/${budget.id}/authorize`, {
        mode,
        dailyMediaSpendCapMajor: Number(dailyCap),
        confirmedTotalBudgetMajor: total,
        acceptedAuthorizationTerms: true,
        password,
      })
      setPassword('')
      setAccepted(false)
      addToast('Paid advertising limits authorized. TrillionAI cannot exceed this approved envelope.', 'success')
      onAuthorized?.(res.data?.budget || budget)
    } catch (err) {
      addToast(err.response?.data?.error || 'Unable to authorize paid advertising.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 p-4 space-y-4 rounded-lg" style={{ border: '1px solid var(--gold)', background: 'rgba(196,163,90,0.06)' }}>
      <div className="flex items-start gap-2">
        <ShieldCheck size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--gold-bright)' }} />
        <div>
          <div className="font-semibold" style={{ color: 'var(--gold-bright)' }}>Your advertising authority</div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Choose how much authority TrillionAI has. It may optimise inside your limits, but it cannot raise these caps without you authorizing the new amount again.
          </p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {MODES.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setMode(item.id)}
            className="text-left p-3 rounded-lg"
            style={{ border: mode === item.id ? '2px solid var(--gold)' : '1px solid var(--line)', background: 'var(--bg-card)' }}
          >
            <div className="font-semibold">{item.title}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{item.text}</div>
          </button>
        ))}
      </div>

      <div>
        <div className="flex justify-between gap-4 text-sm mb-2">
          <span style={{ color: 'var(--text-muted)' }}>Maximum provider spend per day</span>
          <strong>{money(dailyCap, currency)}</strong>
        </div>
        <input
          aria-label="Maximum provider spend per day"
          type="range"
          min={Math.min(step, mediaCap || step)}
          max={Math.max(step, mediaCap)}
          step={step}
          value={Math.min(dailyCap, Math.max(step, mediaCap))}
          onChange={(event) => setDailyCap(Number(event.target.value))}
          className="w-full"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4 text-sm">
        <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}>
          <div style={{ color: 'var(--text-muted)' }}>TrillionAI fee</div>
          <strong>{money(fee, currency)}</strong>
        </div>
        <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}>
          <div style={{ color: 'var(--text-muted)' }}>Maximum ad spend</div>
          <strong>{money(mediaCap, currency)}</strong>
        </div>
        <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}>
          <div style={{ color: 'var(--text-muted)' }}>Other authorised costs</div>
          <strong>{money(0, currency)}</strong>
        </div>
        <div className="p-3 rounded-lg" style={{ border: '1px solid var(--gold)' }}>
          <div style={{ color: 'var(--text-muted)' }}>Maximum total exposure</div>
          <strong>{money(total, currency)}</strong>
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        More budget creates more capacity for reach, testing and optimisation; it does not guarantee leads, sales, revenue or return on ad spend.
      </p>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" />
        <span>I authorize the limits shown above, understand the separate TrillionAI fee and third-party advertising spend, and understand that results are not guaranteed.</span>
      </label>

      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <label className="relative">
          <LockKeyhole size={16} className="absolute left-3 top-3" style={{ color: 'var(--text-muted)' }} />
          <input
            aria-label="Re-enter account password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Re-enter account password"
            className="w-full pl-9 pr-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={authorize}
          disabled={busy || !accepted || !password}
          className="px-4 py-2 text-sm uppercase tracking-wider disabled:opacity-40"
          style={{ background: 'var(--gold)', color: '#140f08' }}
        >
          {busy ? 'Authorizing…' : budget.spendAuthorization ? 'Re-authorize limits' : 'Authorize & enable'}
        </button>
      </div>

      {budget.spendAuthorization && (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Current authorization: {budget.spendAuthorization.mode.replaceAll('_', ' ')} · confirmed {new Date(budget.spendAuthorization.confirmedAt).toLocaleString()} · password re-authentication recorded without storing the password.
        </div>
      )}
    </div>
  )
}
