import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, DollarSign, PauseCircle, PlayCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

const lines = (value) => String(value || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)

const emptyMeta = {
  name: '',
  destinationUrl: '',
  imageUrl: '',
  pageId: '',
  instagramActorId: '',
  primaryText: '',
  headline: '',
  description: '',
  countries: 'NZ',
  startTime: '',
  endTime: '',
  specialAdCategoriesDeclared: false,
  specialAdCategories: '',
}

const emptyGoogle = {
  name: '',
  destinationUrl: '',
  headlines: '',
  descriptions: '',
  keywords: '',
  countryCode: 'NZ',
  startDate: '',
  endDate: '',
  euPoliticalAdvertising: '',
}

function formatMajor(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(amount || 0))
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency || 'USD'}`
  }
}

function budgetMajor(budget, field) {
  const exponent = Number.isInteger(budget?.currencyExponent) ? budget.currencyExponent : 2
  return Number(budget?.[field] || 0) / (10 ** exponent)
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

  const managedProviders = Array.isArray(policy?.managedProviders) ? policy.managedProviders : []
  const selectedProviderReady = managedProviders.includes(provider)
  const selectedAccount = accounts.find((account) => account.providerAccountId === accountId) || null
  const currency = selectedAccount?.currency || 'USD'
  const feePct = useMemo(() => ((policy?.serviceFeeBps || 500) / 100).toFixed(1), [policy])
  const projectedFee = Math.max(0.5, limit * ((policy?.serviceFeeBps || 500) / 10000))
  const projectedMedia = Math.max(0, limit - projectedFee)

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
      if (!next.length) setAccountError('No launchable advertising accounts were returned by this provider.')
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
      return {
        ...meta,
        countries: lines(meta.countries),
        specialAdCategories: lines(meta.specialAdCategories),
        specialAdCategoriesDeclared: meta.specialAdCategoriesDeclared === true,
      }
    }
    return {
      ...google,
      headlines: lines(google.headlines),
      descriptions: lines(google.descriptions),
      keywords: lines(google.keywords),
    }
  }

  const createBudget = async () => {
    if (!selectedAccount) {
      addToast('Connect and select a real advertising account first.', 'warning')
      return
    }
    setBusy(true)
    try {
      const res = await api.post('/paid-ads', {
        provider,
        providerAccountId: selectedAccount.providerAccountId,
        campaignConfig: campaignConfig(),
        enabled: selectedProviderReady ? enabled : false,
        totalBudgetMajor: limit,
      })
      setBudgets((prev) => [res.data, ...prev])
      addToast(
        selectedProviderReady
          ? 'Campaign budget and launch configuration created.'
          : 'Campaign configuration saved. Fee checkout and live launch remain blocked until this provider passes production certification.',
        'success',
      )
    } catch (err) {
      addToast(err.response?.data?.error || 'Unable to create campaign budget.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleBudget = async (budget) => {
    const providerReady = managedProviders.includes(budget.provider)
    if (!providerReady && !budget.enabled) {
      addToast('This provider has not passed live managed-ad certification yet.', 'warning')
      return
    }
    try {
      const res = await api.patch(`/paid-ads/${budget.id}`, { enabled: !budget.enabled })
      setBudgets((prev) => prev.map((item) => item.id === budget.id ? res.data : item))
    } catch (err) {
      addToast(err.response?.data?.error || 'Unable to update campaign state.', 'error')
    }
  }

  const payFee = async (budget) => {
    try {
      const res = await api.post(`/paid-ads/${budget.id}/service-fee-checkout`)
      if (res.data?.url) window.location.href = res.data.url
    } catch (err) {
      addToast(err.response?.data?.error || 'Unable to start service-fee checkout.', 'error')
    }
  }

  const activate = async (budget) => {
    try {
      const res = await api.post(`/paid-ads/${budget.id}/activate`)
      addToast(res.data?.message || 'Provider campaign launched.', 'success')
      await load()
    } catch (err) {
      addToast(err.response?.data?.error || 'Provider campaign did not launch.', 'warning')
    }
  }

  const reconcile = async (budget) => {
    try {
      await api.post(`/paid-ads/${budget.id}/reconcile`)
      await load()
      addToast('Provider spend reconciled.', 'success')
    } catch (err) {
      addToast(err.response?.data?.error || 'Unable to reconcile provider spend.', 'error')
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
          Configure the real provider account, creative, compliance declarations, schedule and all-in spend ceiling before any paid ad can run. The management fee is blocked until the provider adapter has passed live production certification.
        </p>
      </div>

      <div className="p-5 space-y-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold" style={{ color: 'var(--gold-bright)' }}>Paid advertising</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {selectedProviderReady ? 'This provider is live-certified for managed launch.' : 'You can prepare the campaign, but charging and live launch remain blocked until provider certification.'}
            </div>
          </div>
          <button type="button" aria-pressed={enabled} disabled={!selectedProviderReady} onClick={() => setEnabled((value) => !value)} className="relative h-7 w-12 rounded-full disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: enabled ? 'var(--gold)' : 'var(--line)' }}>
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
              <option value="">Select a verified provider account</option>
              {accounts.map((account) => (
                <option key={`${account.loginCustomerId || 'direct'}:${account.providerAccountId}`} value={account.providerAccountId}>
                  {account.name} ({account.accountId || account.providerAccountId}) — {account.currency}{account.loginCustomerId ? ' via manager' : ''}
                </option>
              ))}
            </select>
            {selectedAccount && <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Budget currency: {selectedAccount.currency} · Time zone: {selectedAccount.timezone || 'provider default'}</p>}
            {accountError && <p className="text-xs mt-2 text-amber-600">{accountError} Use Connectors to authorize the provider, then refresh.</p>}
          </div>
        </div>

        {provider === 'meta' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <input aria-label="Campaign name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Campaign name" className="px-3 py-2" />
            <input aria-label="Destination URL" value={meta.destinationUrl} onChange={(e) => setMeta({ ...meta, destinationUrl: e.target.value })} placeholder="https://your-site.com/offer" className="px-3 py-2" />
            <input aria-label="Creative image URL" value={meta.imageUrl} onChange={(e) => setMeta({ ...meta, imageUrl: e.target.value })} placeholder="https://your-site.com/ad-image.jpg" className="px-3 py-2" />
            <input aria-label="Meta Page ID" value={meta.pageId} onChange={(e) => setMeta({ ...meta, pageId: e.target.value })} placeholder="Meta Page ID" className="px-3 py-2" />
            <input aria-label="Instagram actor ID" value={meta.instagramActorId} onChange={(e) => setMeta({ ...meta, instagramActorId: e.target.value })} placeholder="Instagram actor ID (optional)" className="px-3 py-2" />
            <input aria-label="Target countries" value={meta.countries} onChange={(e) => setMeta({ ...meta, countries: e.target.value })} placeholder="NZ, AU" className="px-3 py-2" />
            <textarea aria-label="Primary ad text" value={meta.primaryText} onChange={(e) => setMeta({ ...meta, primaryText: e.target.value })} placeholder="Primary ad text" className="px-3 py-2 md:col-span-2" rows={3} />
            <input aria-label="Ad headline" value={meta.headline} onChange={(e) => setMeta({ ...meta, headline: e.target.value })} placeholder="Ad headline" className="px-3 py-2" />
            <input aria-label="Ad description" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="Description (optional)" className="px-3 py-2" />
            <label className="text-sm">Start<input aria-label="Meta campaign start" type="datetime-local" value={meta.startTime} onChange={(e) => setMeta({ ...meta, startTime: e.target.value })} className="mt-1 block w-full px-3 py-2" /></label>
            <label className="text-sm">End<input aria-label="Meta campaign end" type="datetime-local" value={meta.endTime} onChange={(e) => setMeta({ ...meta, endTime: e.target.value })} className="mt-1 block w-full px-3 py-2" /></label>
            <label className="md:col-span-2 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={meta.specialAdCategoriesDeclared} onChange={(e) => setMeta({ ...meta, specialAdCategoriesDeclared: e.target.checked })} />
              <span>I have reviewed Meta special-ad-category requirements and declare the categories below. Leave the category field empty only when none apply.</span>
            </label>
            <input aria-label="Meta special ad categories" value={meta.specialAdCategories} onChange={(e) => setMeta({ ...meta, specialAdCategories: e.target.value })} placeholder="e.g. HOUSING, EMPLOYMENT, CREDIT — or leave blank when none apply" className="px-3 py-2 md:col-span-2" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <input aria-label="Campaign name" value={google.name} onChange={(e) => setGoogle({ ...google, name: e.target.value })} placeholder="Campaign name" className="px-3 py-2" />
            <input aria-label="Destination URL" value={google.destinationUrl} onChange={(e) => setGoogle({ ...google, destinationUrl: e.target.value })} placeholder="https://your-site.com/offer" className="px-3 py-2" />
            <textarea aria-label="Google headlines" value={google.headlines} onChange={(e) => setGoogle({ ...google, headlines: e.target.value })} placeholder={'At least 3 headlines, one per line\nHeadline two\nHeadline three'} className="px-3 py-2" rows={4} />
            <textarea aria-label="Google descriptions" value={google.descriptions} onChange={(e) => setGoogle({ ...google, descriptions: e.target.value })} placeholder={'At least 2 descriptions, one per line\nSecond description'} className="px-3 py-2" rows={4} />
            <textarea aria-label="Google keywords" value={google.keywords} onChange={(e) => setGoogle({ ...google, keywords: e.target.value })} placeholder={'Keywords, one per line\nsecond keyword'} className="px-3 py-2" rows={4} />
            <input aria-label="Country code" value={google.countryCode} onChange={(e) => setGoogle({ ...google, countryCode: e.target.value.toUpperCase().slice(0, 2) })} placeholder="NZ" className="px-3 py-2" />
            <label className="text-sm">Start date<input aria-label="Google campaign start" type="date" value={google.startDate} onChange={(e) => setGoogle({ ...google, startDate: e.target.value })} className="mt-1 block w-full px-3 py-2" /></label>
            <label className="text-sm">End date<input aria-label="Google campaign end" type="date" value={google.endDate} onChange={(e) => setGoogle({ ...google, endDate: e.target.value })} className="mt-1 block w-full px-3 py-2" /></label>
            <label className="md:col-span-2 text-sm">EU political advertising declaration
              <select aria-label="EU political advertising declaration" value={google.euPoliticalAdvertising} onChange={(e) => setGoogle({ ...google, euPoliticalAdvertising: e.target.value })} className="mt-1 block w-full px-3 py-2">
                <option value="">Select declaration</option>
                <option value="DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING">Does not contain EU political advertising</option>
                <option value="CONTAINS_EU_POLITICAL_ADVERTISING">Contains EU political advertising</option>
              </select>
            </label>
          </div>
        )}

        {!selectedProviderReady && <p className="text-sm text-amber-600">The execution code is kept behind a live-certification gate. You can prepare a valid campaign, but fee checkout and provider launch remain disabled until real-provider testing is completed.</p>}

        <div>
          <div className="flex justify-between text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            <span>Strict all-in spend limit</span><strong style={{ color: 'var(--gold-bright)' }}>{formatMajor(limit, currency)}</strong>
          </div>
          <input type="range" min="10" max="5000" step="10" value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
            <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}><div style={{ color: 'var(--text-muted)' }}>Your total limit</div><div className="font-semibold">{formatMajor(limit, currency)}</div></div>
            <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}><div style={{ color: 'var(--text-muted)' }}>TrillionAI service fee ({feePct}%)</div><div className="font-semibold">{formatMajor(projectedFee, currency)}</div></div>
            <div className="p-3 rounded-lg" style={{ border: '1px solid var(--line)' }}><div style={{ color: 'var(--text-muted)' }}>Maximum provider media spend</div><div className="font-semibold">{formatMajor(projectedMedia, currency)}</div></div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm p-3 rounded-lg" style={{ background: 'rgba(196,163,90,0.08)', color: 'var(--text-muted)' }}>
          <ShieldCheck size={18} className="shrink-0" />
          <span>Strict hard stop is mandatory. TrillionAI creates provider campaigns with provider-side lifetime/total budgets and also reconciles live spend. A failed provider pause is reported as a failure, never as a successful stop.</span>
        </div>

        <button onClick={createBudget} disabled={busy || !selectedAccount} className="px-4 py-2 text-sm uppercase tracking-widest disabled:opacity-40" style={{ background: 'var(--gold)', color: '#140f08' }}>
          {busy ? 'Saving…' : selectedProviderReady ? 'Create campaign budget' : 'Save certified-ready campaign draft'}
        </button>
      </div>

      <div className="space-y-3">
        {budgets.map((budget) => {
          const providerReady = managedProviders.includes(budget.provider)
          const configured = Boolean(budget.providerAccountId && budget.providerAccount?.currency && budget.campaignConfig)
          const budgetCurrency = budget.currency || budget.providerAccount?.currency || 'USD'
          return (
            <div key={budget.id} className="p-5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div className="font-semibold capitalize" style={{ color: 'var(--gold-bright)' }}>{budget.provider} paid ads</div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Total {formatMajor(budgetMajor(budget, 'totalBudgetCents'), budgetCurrency)} · service fee {formatMajor(budgetMajor(budget, 'serviceFeeCents'), budgetCurrency)} · media cap {formatMajor(budgetMajor(budget, 'mediaSpendCapCents'), budgetCurrency)}
                  </div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Provider spend {formatMajor(budgetMajor(budget, 'reportedMediaSpendCents'), budgetCurrency)} · remaining {formatMajor(budgetMajor(budget, 'remainingMediaBudgetCents'), budgetCurrency)} · Status: {budget.status}
                  </div>
                  <div className="text-sm mt-1" style={{ color: configured ? '#22c55e' : '#f59e0b' }}>{configured ? `Configured for ${budget.providerAccount?.name || budget.providerAccountId} (${budgetCurrency})` : 'Campaign setup incomplete'}</div>
                  {!providerReady && <div className="text-sm mt-2 text-amber-600">Execution remains locked until live provider certification. No management-fee checkout or live activation is permitted.</div>}
                </div>
                <button onClick={() => toggleBudget(budget)} disabled={!providerReady && !budget.enabled} className="inline-flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  {budget.enabled ? <PauseCircle size={18} /> : <PlayCircle size={18} />}{budget.enabled ? 'Pause provider campaign' : 'Enable for launch'}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {providerReady && configured && budget.enabled && !budget.serviceFeePaidAt && <button onClick={() => payFee(budget)} className="px-3 py-2 text-sm rounded-lg" style={{ border: '1px solid var(--gold)', color: 'var(--gold-bright)' }}><DollarSign size={15} className="inline mr-1" /> Pay service fee</button>}
                {providerReady && configured && budget.enabled && budget.serviceFeePaidAt && !budget.providerCampaignId && <button onClick={() => activate(budget)} className="px-3 py-2 text-sm rounded-lg" style={{ border: '1px solid var(--cyan)', color: 'var(--cyan)' }}>Launch managed ads</button>}
                {budget.providerCampaignId && <button onClick={() => reconcile(budget)} className="px-3 py-2 text-sm rounded-lg" style={{ border: '1px solid var(--line)' }}><RefreshCw size={15} className="inline mr-1" /> Reconcile spend</button>}
                {budget.status === 'hard_stopped' && <span className="inline-flex items-center gap-2 text-sm text-red-500"><AlertTriangle size={16} /> Provider campaign hard-stopped at the configured spend limit.</span>}
                {budget.status === 'provider_pause_failed' && <span className="inline-flex items-center gap-2 text-sm text-red-500"><AlertTriangle size={16} /> Provider pause failed. This requires immediate attention and is not reported as stopped.</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
