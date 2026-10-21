import { useEffect, useState } from 'react'
import api from '../services/api'
import { AlertTriangle, ArrowLeft, FileText, Plus, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detail, setDetail] = useState(null)
  const [searchParams] = useSearchParams()
  const createdId = searchParams.get('created')

  const openCampaign = async (campaign) => {
    setDetailLoading(true)
    setDetailError('')
    try {
      if (campaign.productName) {
        const res = await api.get(`/products/${campaign.id}`)
        setDetail({
          campaign: res.data?.campaign || campaign,
          contentItems: Array.isArray(res.data?.contentItems) ? res.data.contentItems : [],
        })
      } else {
        const res = await api.get(`/campaigns/${campaign.id}`)
        setDetail({ campaign: res.data || campaign, contentItems: [] })
      }
    } catch (error) {
      setDetailError(error.response?.data?.error || 'Unable to load this campaign for review.')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    api.get('/campaigns').then(async (res) => {
      if (cancelled) return
      const rows = Array.isArray(res.data) ? res.data : []
      setCampaigns(rows)
      setLoading(false)
      if (createdId) {
        const created = rows.find((campaign) => String(campaign.id) === String(createdId))
        if (created) await openCampaign(created)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [createdId])

  const campaign = detail?.campaign
  const contentItems = detail?.contentItems || []
  const generationErrors = Array.isArray(campaign?.generationErrors) ? campaign.generationErrors : []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Back to dashboard">
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review saved strategy and content before taking any publishing action.</p>
            </div>
          </div>
          <Link to="/dashboard/products" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={16} /> New Campaign
          </Link>
        </div>

        {createdId && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 px-4 py-3 text-sm text-green-800 dark:text-green-300">
            Campaign created and saved. Review the strategy and generated drafts below. Nothing is published automatically.
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No campaigns yet.</p>
            <Link to="/dashboard/products" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"><Plus size={16} /> Create first campaign</Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => openCampaign(item)}
                className="text-left w-full bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{item.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.status} • Budget: ${item.budget ?? 0}</p>
                    {item.generationStatus === 'partial_failure' && <p className="text-xs text-amber-600 mt-1">Some campaign assets need attention.</p>}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.status === 'running' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                    item.status === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                    item.status === 'attention_required' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' :
                    'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}>{item.status}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {detailLoading && <div className="rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 p-6 text-gray-500">Loading campaign review…</div>}
        {detailError && <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{detailError}</div>}

        {campaign && !detailLoading && (
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Review campaign</div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{campaign.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Status: {campaign.status} · Budget: ${campaign.budget ?? 0}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close campaign review"><X size={18} /></button>
            </div>

            {generationErrors.length > 0 && (
              <div className="m-5 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
                <div className="font-semibold flex items-center gap-2"><AlertTriangle size={17} /> Some generated assets failed</div>
                <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
                  {generationErrors.map((entry, index) => <li key={`${entry.component}-${index}`}>{entry.component}: {entry.error}</li>)}
                </ul>
              </div>
            )}

            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Campaign context</h3>
                  <dl className="mt-2 text-sm space-y-2">
                    <div><dt className="text-gray-500">Target audience</dt><dd className="text-gray-900 dark:text-gray-100">{campaign.targetAudience || 'Not specified'}</dd></div>
                    <div><dt className="text-gray-500">Platforms</dt><dd className="text-gray-900 dark:text-gray-100">{Array.isArray(campaign.platforms) ? campaign.platforms.join(', ') : 'Not specified'}</dd></div>
                  </dl>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Strategy</h3>
                  {campaign.strategy ? (
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-gray-50 dark:bg-gray-900 p-4 text-xs text-gray-700 dark:text-gray-300 overflow-auto">{JSON.stringify(campaign.strategy, null, 2)}</pre>
                  ) : <p className="mt-2 text-sm text-gray-500">No saved strategy is available for this campaign.</p>}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Generated drafts</h3>
                  <span className="text-xs text-gray-500">{contentItems.length} saved item{contentItems.length === 1 ? '' : 's'}</span>
                </div>
                {contentItems.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No saved content items are attached to this campaign.</p>
                ) : (
                  <div className="mt-3 space-y-3 max-h-[34rem] overflow-auto pr-1">
                    {contentItems.map((item) => (
                      <article key={item.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center gap-2"><FileText size={15} className="text-blue-600" /><h4 className="font-medium text-sm text-gray-900 dark:text-white">{item.title}</h4></div>
                        <div className="text-xs text-gray-500 mt-1">{item.platform || item.type || 'content'}</div>
                        <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{item.body || ''}</div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Review and edit your drafts before publishing. Opening this campaign does not publish anything.</p>
              <div className="flex gap-2">
                <Link to="/dashboard/content" className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm">Open Content Studio</Link>
                <Link to="/dashboard/social" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">Review social publishing</Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
