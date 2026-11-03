import { useEffect, useState } from 'react'
import api from '../services/api'
import PaidAdvertising from './PaidAdvertising'
import PaidAdAuthorizationPanel from '../components/PaidAdAuthorizationPanel'

export default function PaidAdvertisingAuthorized() {
  const [budgets, setBudgets] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  const loadBudgets = async () => {
    const res = await api.get('/paid-ads')
    setBudgets(Array.isArray(res.data?.budgets) ? res.data.budgets : [])
  }

  useEffect(() => {
    loadBudgets().catch(() => {})
    const timer = window.setInterval(() => loadBudgets().catch(() => {}), 5000)
    return () => window.clearInterval(timer)
  }, [])

  const handleAuthorized = (updated) => {
    setBudgets((current) => current.map((item) => item.id === updated.id ? updated : item))
    setRefreshKey((value) => value + 1)
  }

  return (
    <div className="space-y-6">
      <PaidAdvertising key={refreshKey} />

      {budgets.length > 0 && (
        <section className="space-y-4 max-w-5xl">
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>
              Authorize how TrillionAI may operate
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Drafting a campaign does not give TrillionAI permission to spend. Each campaign must have an explicit customer authorization before checkout or launch.
            </p>
          </div>

          {budgets.map((budget) => (
            <div key={budget.id} className="p-4 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
              <div className="font-semibold capitalize">{budget.provider} · {budget.campaignConfig?.name || 'Campaign draft'}</div>
              <PaidAdAuthorizationPanel budget={budget} onAuthorized={handleAuthorized} />
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
