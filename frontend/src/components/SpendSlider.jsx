import { useEffect, useState } from 'react'
import api from '../services/api'

export default function SpendSlider({ compact = false }) {
  const [budget, setBudget] = useState(null)
  const [addon, setAddon] = useState(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get('/ads/budget').then((r) => setBudget(r.data)).catch(() => {})
    api.get('/ads/addon').then((r) => setAddon(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const save = async (patch) => {
    setSaving(true)
    setMsg('')
    try {
      const res = await api.patch('/ads/budget', patch)
      setBudget(res.data)
      setMsg('Cap saved. Paid ads cannot exceed this.')
    } catch (err) {
      setMsg(err.response?.data?.error || 'Could not save cap')
    } finally {
      setSaving(false)
    }
  }

  const optIn = async () => {
    setSaving(true)
    try {
      const res = await api.post('/ads/addon', { confirm: true })
      setAddon((a) => ({ ...a, optedIn: true }))
      setBudget(res.data)
      setMsg('Paid ads add-on on. Media spend is extra and capped.')
    } catch (err) {
      setMsg(err.response?.data?.error || 'Could not opt in')
    } finally {
      setSaving(false)
    }
  }

  if (!budget) return null
  const daily = budget.dailyMax
  const monthly = budget.monthlyMax

  return (
    <div data-spend-slider="hard-daily-and-monthly-cap" className="rounded-lg p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
      <div>
        <h3 className="font-semibold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Paid ads spend cap</h3>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Hard max daily AND monthly. Default low ($10 / $100). Remaining budget shown. The app MUST NOT exceed this cap.
          Organic posts on your connected socials are included in your plan and do not use this slider.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="block text-sm">
          <span style={{ color: 'var(--gold)' }}>Daily max ${daily}</span>
          <input type="range" min="0" max="500" step="1" value={Math.min(daily, 500)}
            onChange={(e) => setBudget({ ...budget, dailyMax: Number(e.target.value) })}
            onMouseUp={() => save({ dailyMax: daily, monthlyMax: monthly })}
            onTouchEnd={() => save({ dailyMax: daily, monthlyMax: monthly })}
            className="w-full mt-2" />
          <input type="number" min="0" step="1" value={daily}
            onChange={(e) => setBudget({ ...budget, dailyMax: Number(e.target.value) })}
            onBlur={() => save({ dailyMax: daily, monthlyMax: monthly })}
            className="mt-2 w-28 px-2 py-1 text-sm rounded" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)' }} />
        </label>
        <label className="block text-sm">
          <span style={{ color: 'var(--gold)' }}>Monthly max ${monthly}</span>
          <input type="range" min="0" max="5000" step="10" value={Math.min(monthly, 5000)}
            onChange={(e) => setBudget({ ...budget, monthlyMax: Number(e.target.value) })}
            onMouseUp={() => save({ dailyMax: daily, monthlyMax: monthly })}
            onTouchEnd={() => save({ dailyMax: daily, monthlyMax: monthly })}
            className="w-full mt-2" />
          <input type="number" min="0" step="10" value={monthly}
            onChange={(e) => setBudget({ ...budget, monthlyMax: Number(e.target.value) })}
            onBlur={() => save({ dailyMax: daily, monthlyMax: monthly })}
            className="mt-2 w-28 px-2 py-1 text-sm rounded" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)' }} />
        </label>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div>Remaining today <strong style={{ color: 'var(--gold-bright)' }}>${budget.remainingToday}</strong></div>
        <div>Remaining this month <strong style={{ color: 'var(--gold-bright)' }}>${budget.remainingMonth}</strong></div>
        <div>Spent today ${budget.daySpent}</div>
        <div>Spent this month ${budget.monthSpent}</div>
      </div>
      {!compact && (
        <div className="pt-2" style={{ borderTop: '1px solid var(--line)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {addon?.note || 'Paid Meta/Google ads are an add-on. Organic is free on your plan.'}
          </p>
          {budget.paidAdsAddon || addon?.optedIn ? (
            <p className="text-sm mt-2" style={{ color: 'var(--cyan)' }}>Paid ads add-on is on. Launch still cannot exceed the slider.</p>
          ) : (
            <button type="button" disabled={saving} onClick={optIn}
              className="mkt-btn mkt-btn-gold mt-3 min-h-[48px] text-sm font-medium"
              style={{ background: '#c4a35a', color: '#07080b' }}>
              Opt in to paid ads add-on ($49/mo + pass-through media)
            </button>
          )}
        </div>
      )}
      {msg && <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{msg}</p>}
    </div>
  )
}
