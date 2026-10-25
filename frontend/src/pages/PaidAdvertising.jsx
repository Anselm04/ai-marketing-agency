import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, DollarSign, PauseCircle, PlayCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

const dollars = (cents = 0) => (Number(cents || 0) / 100).toFixed(2)
const lines = (value) => String(value || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)

const emptyMeta = {
  name: '', destinationUrl: '', pageId: '', instagramActorId: '', primaryText: '', headline: '', description: '', countries: 'NZ',
}
const emptyGoogle = {
  name: '', destinationUrl: '', headlines: '', descriptions: '', keywords: '', languageCode: 'en', countryCode: 'NZ',
}

export default function PaidAdvertising() {
  const { addToast } = useToast()
  const [budgets, setBudgets] = useState([])
  const [policy, setPolicy] = useState(null)
  const [provider, setProvider] = useState('meta')
  const [enabled, setEnabled] = useState(false)
  const [limit, setLimit] = useState(100)
  const [busy, setBusy] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [meta, setMeta] = useState(emptyMeta)
  const [google, setGoogle] = useState(emptyGoogle)

  const feePct = useMemo(() => ((policy?.serviceFeeBps || 500) / 100).toFixed(1), [policy])
  const projectedFee = Math.max(0.5, limit * ((policy?.serviceFeeBps || 500) / 10000))
  const projectedMedia = Math.max(0, limit - projectedFee)
  const managedProviders = Array.isArray(policy?.managedProviders) ? policy.managedProviders : []
  const selectedProviderReady = managedProviders.includes(provider)

  const load = async () => {
    const res = await api.get('/paid-ads')
    setBudgets(Array.isArray(res.data?.budgets) ? res.data.budgets : [])
    setPolicy(res.data?.policy || null)
  }

  const loadAccounts = async (providerId = provider) => {
    setAccountsLoading(true)
    setAccountError('')
    setAccounts([])
    setAccountId('')
    try {
      const res = await api.get(`/paid-ads/providers/${providerId}/accounts`)
      const next = Array.isArray(res.data?.accounts) ? res.data.accounts : []
      setAccounts(next)
      if (next.length === 1) setAccountId(next[0].providerAccountId)
      if (!next.length) setAccountError('No accessible advertising accounts were returned by this provider.')
    } catch (err) {
      setAccountError(err.response?.data?.error || 'Connect this advertising provider before selecting an account.')
    } finally {
      setAccountsLoading(false)
    }
  }

  useEffect(() => { load().catch(() => {}) }, [])
  useEffect(() => { loadAccounts(provider).catch(() => {}) }, [provider])

  const campaignConfig = () => {
    if (provider === 'meta') {
      const hasAny = Object.values(meta).some((value) => String(value || '').trim())
      if (!hasAny) return null
      return {
        ...meta,
        countries: lines(meta.countries),
      }
    }
    const hasAny = Object.values(google).some((value) => String(value || '').trim())
    if (!hasAny) return null
    return {
      ...google,
      headlines: lines(google.headlines),
      descriptions: lines(google.descriptions),
      keywords: lines(google.keywords),
    }
  }

  const createBudget = async () => {
    setBusy(true)
    try {
      const config = campaignConfig()
      const res = await api.post('/paid-ads', {
        provider,
        providerAccountId: accountId || null,
        campaignConfig: config,
        enabled: selectedProviderReady ? enabled : false,
        totalBudgetCents: Math.round(limit * 100),
      })
      setBudgets((prev) => [res.data, ...prev])
      const configured = Boolean(res.data?.providerAccountId && res.data?.campaignConfig)
      addToast(
        configured
          ? selectedProviderReady ? 'Paid advertising campaign budget created.' : 'Campaign configuration saved. Live launch remains blocked until the managed adapter is verified.'
          : 'Disabled budget draft saved. Select an account and complete campaign details before launch.',
        'success',
      )
    } catch (err) {
      addToast(err.response?.data?.error || 'Unable to create budget.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleBudget = async (budget) => {
    const providerReady = managedProviders.includes(budget.provider)
    if (!providerReady && !budget.enabled) {
      addToast('This provider is not approved for managed paid advertising yet.', 'warning')
      return
    }
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

  const changeProvider = (event) => {
    setProvider(event.target.value)
    setEnabled(false)
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>Paid Advertising Control</h2>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
          Configure the real provider account, campaign creative and all-in spend ceiling before any paid ad can run. TrillionAI charges a management fee only after the selected provider has a production-approved managed adapter with verified hard-stop controls.
        </p>
      </div>

      <div className="p-5 space-y-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold" style={{ color: 'var(--gold-bright)' }}>Paid advertising</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {selectedProviderReady ? 'Managed provider controls are available. Nothing can activate while this switch is off.' : 'Campaigns can be configured now, but charging and live launch remain blocked until provider-side hard-stop enforcement is verified.'}
            </div>
          </div>
          <button type="button" aria-pressed={enabled} disabled={!selectedProviderReady} onClick={() => setEnabled((v) => !v)} className="relative h-7 w-12 rounded-full disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: enabled ? 'var(--gold)' : 'var(--line)' }}>
            <span className={'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ' + (enabled ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm" style={{ color: 'var(--text-muted)' }}>Provider</label>
            <select value={provider} onChange={changeProvider} className="block mt-1 w-full px-3 py-2" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--gold)' }}>
              <option value="meta">Meta / Facebook / Instagram Ads</option>
              <option value="google">Google Ads</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm" style={{ color: 'var(--text-muted)' }}>Connected advertising account</label>
              <button type="button" onClick={() => loadAccounts()} disabled={accountsLoading} className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--cyan)' }}><RefreshCw size={13} className={accountsLoading ? 'animate-spin' : ''} /> Refresh</button>
            </div>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="block mt-1 w-full px-3 py-2" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)' }}>
              <option value="">Select a real provider account</option>
              {accounts.map((account) => <option key={account.providerAccountId} value={account.providerAccountId}>{account.name} ({account.accountId || account.providerAccountId})</option>)}
            </select>
            {accountError && <p className="text-xs mt-2 text-amber-600">{accountError} Use Connectors to authorize the provider, then refresh.</p>}
          </div>
        </div>

        {provider === 'meta' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <input aria-label="Campaign name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Campaign name" className="px-3 py-2" />
            <input aria-label="Destination URL" value={meta.destinationUrl} onChange={(e) => setMeta({ ...meta, destinationUrl: e.target.value })} placeholder="https://your-site.com/offer" className="px-3 py-2" />
            <input aria-label="Meta Page ID" value={meta.pageId} onChange={(e) => setMeta({ ...meta, pageId: e.target.value })} placeholder="Meta Page ID" className="px-3 py-2" />
            <input aria-label="Instagram actor ID" value={meta.instagramActorId} onChange={(e) => setMeta({ ...meta, instagramActorId: e.target.value })} placeholder="Instagram actor ID (optional)" className="px-3 py-2" />
            <textarea aria-label="Primary ad text" value={meta.primaryText} onChange={(e) => setMeta({ ...meta, primaryText: e.target.value })} placeholder="Primary ad text" className="px-3 py-2 md:col-span-2" rows={3} />
            <input aria-label="Ad headline" value={meta.headline} onChange={(e) => setMeta({ ...meta, headline: e.target.value })} placeholder="Ad headline" className="px-3 py-2" />
            <input aria-label="Target countries" value={meta.countries} onChange={(e) => setMeta({ ...meta, countries: e.target.value })} placeholder="NZ, AU" className="px-3 py-2" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <input aria-label="Campaign name" value={google.name} onChange={(e) => setGoogle({ ...google, name: e.target.value })} placeholder="Campaign name" className="px-3 py-2" />
            <input aria-label="Destination URL" value={google.destinationUrl} onChange={(e) => setGoogle({ ...google, destinationUrl: e.target.value })} placeholder="https://your-site.com/offer" className="px-3 py-2" />
            <textarea aria-label="Google headlines" value={google.headlines} onChange={(e) => setGoogle({ ...google, headlines: e.target.value })} placeholder={'At least 3 headlines, one per line\nHeadline two\nHeadline three'} className="px-3 py-2" rows={4} />
            <textarea aria-label="Google descriptions" value={google.descriptions} onChange={(e) => setGoogle({ ...google, descriptions: e.target.value })} placeholder={'At least 2 descriptions, one per line\nSecond description'} className="px-3 py-2" rows={4} />
            <textarea aria-label="Google keywords" value={google.keywords} onChange={(e) => setGoogle({ ...google, keywords: e.target.value })} placeholder={'Keywords, one per line\nsecond keyword'} className="px-3 py-2" rows={4} />
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Language code" value={google.languageCode} onChange={(e) => setGoogle({ ...google, languageCode: e.target.value })} placeholder="en" className="px-3 py-2" />
              <input aria-label="Country code" value={google.countryCode} onChange={(e) => setGoogle({ ...google, countryCode: e.target.value })} placeholder="NZ" className="px-3 py-2" />
            </div>
          </div>
        )}

        {!selectedProviderReady && <p className="text-sm text-amber-600">Provider-side campaign execution and hard-stop enforcement are not yet certified. You may prepare and save the configuration, but fee checkout and activation stay disabled.</p>}

        <div>
          <div className="flex justify-between text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            <span>Strict all-in spend limit</span><strong style={{ color: 'var(--gold-bright)' }}>${limit.toFixed(0)} USD</strong>
          </div>
          <input type="range" min="10" max="5000" step="10" value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
            <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}><div style={{ color: 'var(--text-muted)' }}>Your total limit</div><div className="font-semibold">${limit.toFixed(2)}</div></div>
            <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}><div style={{ color: 'var(--text-muted)' }}>TrillionAI service fee ({feePct}%)</div><div className="font-semibold">${projectedFee.toFixed(2)}</div></div>
            <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}><div style={{ color: 'var(--text-muted)' }}>Maximum external media spend</div><div className="font-semibold">${projectedMedia.toFixed(2)}</div></div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm p-3 rounded-lg" style={{ background: 'rgba(196,163,90,0.08)', color: 'var(--text-muted)' }}>
          <ShieldCheck size={18} className="shrink-0" />
          <span>Strict hard stop is mandatory. TrillionAI will not charge its paid-ad management fee or enable a live provider unless the provider adapter can enforce budget caps and pause campaigns. Ads run directly outside TrillionAI are outside this limit.</span>
        </div>

        <button onClick={createBudget} disabled={busy} className="px-4 py-2 text-sm uppercase tracking-widest" style={{ background: 'var(--gold)', color: '#140f08' }}>
          {busy ? 'Saving…' : selectedProviderReady ? 'Create campaign budget' : 'Save campaign draft'}
        </button>
      </div>

      <div className="space-y-3">
        {budgets.map((budget) => {
          const providerReady = managedProviders.includes(budget.provider)
          const configured = Boolean(budget.providerAccountId && budget.campaignConfig)
          return (
            <div key={budget.id} className="p-5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div className="font-semibold capitalize" style={{ color: 'var(--gold-bright)' }}>{budget.provider} paid ads</div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Total ${dollars(budget.totalBudgetCents)} · service fee ${dollars(budget.serviceFeeCents)} · media cap ${dollars(budget.mediaSpendCapCents)}</div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Remaining media budget: ${dollars(budget.remainingMediaBudgetCents)} · Status: {budget.status}</div>
                  <div className="text-sm mt-1" style={{ color: configured ? '#22c55e' : '#f59e0b' }}>{configured ? `Configured for ${budget.providerAccount?.name || budget.providerAccountId}` : 'Campaign setup incomplete'}</div>
                  {!providerReady && <div className="text-sm mt-2 text-amber-600">Managed provider adapter is not production-certified. No management-fee checkout or live activation is permitted.</div>}
                </div>
                <button onClick={() => toggleBudget(budget)} disabled={!providerReady && !budget.enabled} className="inline-flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  {budget.enabled ? <PauseCircle size={18} /> : <PlayCircle size={18} />}{budget.enabled ? 'Turn off' : 'Turn on'}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {providerReady && configured && budget.enabled && !budget.serviceFeePaidAt && <button onClick={() => payFee(budget)} className="px-3 py-2 text-sm rounded-lg" style={{ border: '1px solid var(--gold)', color: 'var(--gold-bright)' }}><DollarSign size={15} className="inline mr-1" /> Pay service fee</button>}
                {providerReady && configured && budget.enabled && budget.serviceFeePaidAt && budget.status !== 'hard_stopped' && <button onClick={() => activate(budget)} className="px-3 py-2 text-sm rounded-lg" style={{ border: '1px solid var(--cyan)', color: 'var(--cyan)' }}>Activate managed ads</button>}
                {budget.status === 'hard_stopped' && <span className="inline-flex items-center gap-2 text-sm text-red-500"><AlertTriangle size={16} /> Hard stopped because the spend limit was reached.</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
