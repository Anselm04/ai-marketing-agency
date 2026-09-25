
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3, Brain, CalendarClock, CheckCircle2, Clock3, Eye, Film,
  Image as ImageIcon, MousePointer2, Pause, Play, RefreshCw, Sparkles,
  Trash2, TrendingUp, Zap
} from 'lucide-react'
import api from '../services/api'

const CADENCE = {
  daily: { label: 'Daily', max: 12, period: 'day' },
  weekly: { label: 'Weekly', max: 50, period: 'week' },
  monthly: { label: 'Monthly', max: 120, period: 'month' },
}

function formatHour(hour) {
  const value = Number(hour)
  const normalized = ((value % 24) + 24) % 24
  if (normalized === 0) return '12 AM'
  if (normalized === 12) return '12 PM'
  return normalized < 12 ? normalized + ' AM' : (normalized - 12) + ' PM'
}

function frequencyText(cadence, count) {
  if (cadence === 'daily') {
    if (count === 1) return 'About once per day'
    return 'About every ' + Math.round(24 / count * 10) / 10 + ' hours'
  }
  if (cadence === 'weekly') {
    const hours = (7 * 24) / count
    if (hours >= 24) return 'About every ' + Math.round(hours / 24 * 10) / 10 + ' days'
    return 'About every ' + Math.round(hours * 10) / 10 + ' hours'
  }
  const days = 30 / count
  if (days >= 1) return 'About every ' + Math.round(days * 10) / 10 + ' days'
  return 'About every ' + Math.round(days * 24 * 10) / 10 + ' hours'
}

export default function AutoPosting() {
  const [assets, setAssets] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [plans, setPlans] = useState([])
  const [analyticsByPlan, setAnalyticsByPlan] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    enabled: true,
    name: 'Always-on social posting',
    campaignBrief: '',
    cadence: 'weekly',
    postsPerPeriod: 7,
    sourceAssetIds: [],
    platformIds: [],
    assetsPerPost: 3,
    aspectRatio: '9:16',
    secondsPerImage: 3,
    maxVideoSeconds: 12,
    startImmediately: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    postingWindowStartHour: 8,
    postingWindowEndHour: 21,
    aiOptimizationEnabled: true,
    explorationRate: 0.2,
  })

  const load = async () => {
    try {
      const [mediaRes, platformRes, plansRes] = await Promise.all([
        api.get('/media-library'),
        api.get('/social-video/platforms'),
        api.get('/auto-posting'),
      ])
      setAssets((mediaRes.data.assets || []).filter((asset) => asset.kind === 'media_asset'))
      setPlatforms(
        (platformRes.data.platforms || []).filter(
          (platform) => platform.publish === 'direct_api' && platform.connected,
        ),
      )
      const loadedPlans = plansRes.data.plans || []
      setPlans(loadedPlans)
      const analyticsResults = await Promise.all(
        loadedPlans.map(async (plan) => {
          try {
            const res = await api.get('/auto-posting/' + plan.id + '/analytics')
            return [plan.id, res.data]
          } catch {
            return [plan.id, null]
          }
        }),
      )
      setAnalyticsByPlan(Object.fromEntries(analyticsResults))
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load automated posting settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const cadenceConfig = CADENCE[form.cadence]
  const selectedAssets = useMemo(
    () => assets.filter((asset) => form.sourceAssetIds.includes(String(asset.id))),
    [assets, form.sourceAssetIds],
  )

  const updateCadence = (cadence) => {
    const max = CADENCE[cadence].max
    setForm((current) => ({
      ...current,
      cadence,
      postsPerPeriod: Math.min(current.postsPerPeriod, max),
    }))
  }

  const toggleArray = (key, value) => {
    setForm((current) => {
      const values = current[key]
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      }
    })
  }

  const createPlan = async () => {
    setError('')
    if (!form.sourceAssetIds.length) {
      setError('Choose at least one photo or video for the automation to use.')
      return
    }
    if (!form.platformIds.length) {
      setError('Choose at least one connected social platform.')
      return
    }

    setSaving(true)
    try {
      await api.post('/auto-posting', form)
      setForm((current) => ({ ...current, name: 'Always-on social posting' }))
      await load()
    } catch (err) {
      const unavailable = err.response?.data?.unavailable
      if (Array.isArray(unavailable) && unavailable.length) {
        setError(unavailable.map((item) => item.platformId + ': ' + item.reason).join(' · '))
      } else {
        setError(err.response?.data?.error || 'Unable to save automation')
      }
    } finally {
      setSaving(false)
    }
  }

  const patchPlan = async (plan, patch) => {
    try {
      await api.patch('/auto-posting/' + plan.id, patch)
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update automation')
    }
  }

  const runNow = async (plan) => {
    try {
      await api.post('/auto-posting/' + plan.id + '/run-now')
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to run automation now')
    }
  }

  const deletePlan = async (plan) => {
    try {
      await api.delete('/auto-posting/' + plan.id)
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete automation')
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading automated posting…</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <CalendarClock size={24} className="text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Automated Posting</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choose the content once, choose the social accounts once, then set how often TrillionAI should create and publish fresh videos automatically.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Automation switch</h3>
            <p className="text-xs text-gray-500 mt-1">
              When enabled, the scheduler will create and post on the cadence you choose.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={form.enabled}
            onClick={() => setForm((current) => ({ ...current, enabled: !current.enabled }))}
            className={'relative h-8 w-14 rounded-full transition-colors ' + (form.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600')}
          >
            <span className={'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ' + (form.enabled ? 'translate-x-7' : 'translate-x-1')} />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="text-sm">
            <span className="block mb-1 text-gray-700 dark:text-gray-300">Automation name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 text-gray-700 dark:text-gray-300">Campaign goal / brand instructions</span>
            <input
              value={form.campaignBrief}
              onChange={(event) => setForm({ ...form, campaignBrief: event.target.value })}
              placeholder="Example: promote our app, helpful tone, focus on time-saving benefits"
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
            />
          </label>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Posting period</div>
          <div className="inline-flex rounded-lg border border-gray-200 p-1 dark:border-gray-700">
            {Object.entries(CADENCE).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => updateCadence(key)}
                className={'rounded-md px-4 py-2 text-sm font-medium ' + (form.cadence === key ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Posts per {cadenceConfig.period}</div>
              <div className="mt-1 text-xs text-gray-500">
                Move the slider to choose how active the automation should be.
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-600">{form.postsPerPeriod}</div>
          </div>

          <input
            type="range"
            min="1"
            max={cadenceConfig.max}
            step="1"
            value={form.postsPerPeriod}
            onChange={(event) => setForm({ ...form, postsPerPeriod: Number(event.target.value) })}
            className="mt-4 w-full"
          />

          <div className="mt-2 flex justify-between text-[11px] text-gray-500">
            <span>1</span>
            <span>{frequencyText(form.cadence, form.postsPerPeriod)}</span>
            <span>{cadenceConfig.max}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 space-y-4">
          <div className="flex items-start gap-3">
            <Clock3 size={18} className="mt-0.5 text-blue-600" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Preferred posting hours</div>
              <div className="mt-1 text-xs text-gray-500">
                Automated posts will stay inside this local-time window. The AI optimizer can move posts within the window, but never outside it.
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 flex justify-between text-gray-700 dark:text-gray-300">
                <span>Start time</span>
                <strong>{formatHour(form.postingWindowStartHour)}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="23"
                step="1"
                value={form.postingWindowStartHour}
                onChange={(event) => setForm({ ...form, postingWindowStartHour: Number(event.target.value) })}
                className="w-full"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 flex justify-between text-gray-700 dark:text-gray-300">
                <span>End time</span>
                <strong>{formatHour(form.postingWindowEndHour)}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="23"
                step="1"
                value={form.postingWindowEndHour}
                onChange={(event) => setForm({ ...form, postingWindowEndHour: Number(event.target.value) })}
                className="w-full"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Time zone</div>
              <div className="mt-1 text-xs text-gray-500">{form.timezone}</div>
            </div>
            <div className="text-xs text-gray-500">
              Allowed window: {formatHour(form.postingWindowStartHour)} to {formatHour(form.postingWindowEndHour)}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-950/20">
            <div className="flex items-start gap-2">
              <Brain size={18} className="mt-0.5 text-purple-600" />
              <div>
                <div className="text-sm font-medium text-purple-900 dark:text-purple-200">AI timing & content optimization</div>
                <div className="mt-1 text-xs text-purple-700 dark:text-purple-300">
                  Learn from views, clicks, engagement and conversions, then favor the strongest posting hours and content combinations while still testing alternatives.
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-pressed={form.aiOptimizationEnabled}
              onClick={() => setForm((current) => ({ ...current, aiOptimizationEnabled: !current.aiOptimizationEnabled }))}
              className={'relative h-7 w-12 flex-none rounded-full transition-colors ' + (form.aiOptimizationEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600')}
            >
              <span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ' + (form.aiOptimizationEnabled ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm">
            <span className="block mb-1 text-gray-700 dark:text-gray-300">Media items per generated video</span>
            <input
              type="range"
              min="1"
              max="8"
              value={form.assetsPerPost}
              onChange={(event) => setForm({ ...form, assetsPerPost: Number(event.target.value) })}
              className="w-full"
            />
            <span className="text-xs text-gray-500">{form.assetsPerPost} item{form.assetsPerPost === 1 ? '' : 's'}</span>
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700 dark:text-gray-300">Video shape</span>
            <select
              value={form.aspectRatio}
              onChange={(event) => setForm({ ...form, aspectRatio: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
            >
              <option value="9:16">Vertical 9:16</option>
              <option value="1:1">Square 1:1</option>
              <option value="16:9">Landscape 16:9</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm pt-6">
            <input
              type="checkbox"
              checked={form.startImmediately}
              onChange={(event) => setForm({ ...form, startImmediately: event.target.checked })}
            />
            Create the first post as soon as the plan starts
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Choose source content</h4>
              <p className="text-xs text-gray-500">The app rotates through these photos/videos instead of repeating the exact same material every time.</p>
            </div>
            <span className="text-xs text-gray-500">{selectedAssets.length} selected</span>
          </div>

          {assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700">
              Add photos or videos in My Media first.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {assets.map((asset) => {
                const id = String(asset.id)
                const active = form.sourceAssetIds.includes(id)
                const isVideo = asset.mediaType === 'video' || asset.mimetype?.startsWith('video/')
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => toggleArray('sourceAssetIds', id)}
                    className={'overflow-hidden rounded-lg border text-left ' + (active ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-700')}
                  >
                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-900">
                      {isVideo
                        ? <video src={asset.url} className="h-full w-full object-cover" muted preload="metadata" />
                        : <img src={asset.url} alt="" className="h-full w-full object-cover" />}
                      <div className="absolute left-2 top-2 rounded-full bg-black/60 p-1 text-white">
                        {isVideo ? <Film size={13} /> : <ImageIcon size={13} />}
                      </div>
                      {active && <CheckCircle2 size={20} className="absolute right-2 top-2 text-blue-500 bg-white rounded-full" />}
                    </div>
                    <div className="truncate p-2 text-xs">{asset.originalName || 'Media'}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Choose automatic destinations</h4>
          <p className="mt-1 text-xs text-gray-500">
            Only social accounts that this user has connected and that support automated video publishing are shown here.
          </p>

          {platforms.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700">
              No automatic-posting accounts are connected yet. Connect accounts in Account Connections first.
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {platforms.map((platform) => {
                const active = form.platformIds.includes(platform.id)
                return (
                  <button
                    type="button"
                    key={platform.id}
                    onClick={() => toggleArray('platformIds', platform.id)}
                    className={'rounded-full border px-3 py-2 text-sm ' + (active ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300')}
                  >
                    {active ? '✓ ' : ''}{platform.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
          <div className="font-medium">What happens automatically</div>
          <div className="mt-1 text-xs leading-5">
            TrillionAI rotates through the selected media, generates a fresh social video, writes a new title/caption/hashtags from the campaign brief, and posts it to the selected connected accounts. It stays inside the user’s preferred posting hours, then progressively favors the hours and content combinations that perform best as analytics data accumulates.
          </div>
        </div>

        <button
          type="button"
          onClick={createPlan}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Sparkles size={16} />
          {saving ? 'Saving automation…' : 'Create automated posting plan'}
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your automated posting plans</h3>
          <button type="button" onClick={load} className="inline-flex items-center gap-2 text-sm text-gray-500">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
            No automated posting plans yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</h4>
                    <div className="mt-1 text-xs text-gray-500">
                      {plan.postsPerPeriod} post{plan.postsPerPeriod === 1 ? '' : 's'} / {CADENCE[plan.cadence]?.period || plan.cadence}
                      {' · '}{frequencyText(plan.cadence, plan.postsPerPeriod)}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={plan.enabled}
                    onClick={() => patchPlan(plan, { enabled: !plan.enabled })}
                    className={'relative h-7 w-12 rounded-full transition-colors ' + (plan.enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600')}
                  >
                    <span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ' + (plan.enabled ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
                    <div className="text-gray-500">Created posts</div>
                    <div className="mt-1 text-lg font-semibold">{plan.completedPosts || 0}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
                    <div className="text-gray-500">Platforms</div>
                    <div className="mt-1 text-lg font-semibold">{plan.platformIds?.length || 0}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
                    <div className="text-gray-500">Media pool</div>
                    <div className="mt-1 text-lg font-semibold">{plan.sourceAssetIds?.length || 0}</div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  Next run: {plan.enabled && plan.nextRunAt ? new Date(plan.nextRunAt).toLocaleString() : 'Paused'}
                </div>

                <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900 dark:bg-purple-950/20">
                  <div className="flex items-center gap-2 text-sm font-semibold text-purple-900 dark:text-purple-200">
                    <BarChart3 size={16} />
                    My AI marketing analytics
                  </div>
                  {(() => {
                    const insight = analyticsByPlan[plan.id]
                    const totals = insight?.analytics?.totals
                    const bestHours = insight?.analytics?.bestHours || []
                    const recommendation = insight?.recommendation
                    return (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="rounded-lg bg-white/70 p-3 dark:bg-gray-900/40">
                            <div className="flex items-center gap-1 text-[11px] text-gray-500"><Eye size={12} /> Views</div>
                            <div className="mt-1 font-semibold">{totals?.views || 0}</div>
                          </div>
                          <div className="rounded-lg bg-white/70 p-3 dark:bg-gray-900/40">
                            <div className="flex items-center gap-1 text-[11px] text-gray-500"><MousePointer2 size={12} /> Clicks</div>
                            <div className="mt-1 font-semibold">{totals?.clicks || 0}</div>
                          </div>
                          <div className="rounded-lg bg-white/70 p-3 dark:bg-gray-900/40">
                            <div className="flex items-center gap-1 text-[11px] text-gray-500"><TrendingUp size={12} /> CTR</div>
                            <div className="mt-1 font-semibold">{totals?.clickThroughRate || 0}%</div>
                          </div>
                          <div className="rounded-lg bg-white/70 p-3 dark:bg-gray-900/40">
                            <div className="text-[11px] text-gray-500">Conversions</div>
                            <div className="mt-1 font-semibold">{totals?.conversions || 0}</div>
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-purple-800 dark:text-purple-300">
                          Posting window: {formatHour(plan.postingWindowStartHour ?? 8)}–{formatHour(plan.postingWindowEndHour ?? 21)} · {plan.timezone || 'UTC'}
                        </div>

                        {bestHours.length > 0 ? (
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                            Best learned hours: {bestHours.slice(0, 3).map((item) => formatHour(item.hour)).join(', ')}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-gray-500">
                            Learning phase: analytics will rank the strongest hours after performance data starts arriving.
                          </div>
                        )}

                        <div className="mt-2 text-xs text-gray-500">
                          {recommendation?.reasoning || 'AI optimization is ready to learn from this plan’s results.'}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {plan.lastError && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    {plan.lastError}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runNow(plan)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-700"
                  >
                    <Zap size={14} /> Run one now
                  </button>
                  <button
                    type="button"
                    onClick={() => patchPlan(plan, { enabled: !plan.enabled })}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-700"
                  >
                    {plan.enabled ? <Pause size={14} /> : <Play size={14} />}
                    {plan.enabled ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePlan(plan)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600 dark:border-red-800"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
