import { useEffect, useMemo, useState } from 'react'
import { Bot, CheckCircle2, DollarSign, FileAudio, Film, Pause, Play, RefreshCw, Scissors, Send, ShieldCheck, Sparkles } from 'lucide-react'
import api from '../services/api'

const PLATFORM_OPTIONS = ['TikTok', 'Instagram', 'YouTube', 'Facebook']

const emptyForm = {
  name: '',
  brief: '',
  transcript: '',
  sourceUrl: '',
  sourceDurationSeconds: '',
  targetAudience: '',
  brandVoice: '',
  budget: 10000,
  agencyRate: 20,
  maxClips: 6,
  platforms: ['TikTok', 'Instagram', 'YouTube'],
  rightsConfirmed: false,
  commercialUseAllowed: false,
}

export default function ClippingAgency() {
  const [campaigns, setCampaigns] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState(null)
  const [error, setError] = useState('')

  const loadCampaigns = async () => {
    try {
      setError('')
      const res = await api.get('/clipping/campaigns')
      setCampaigns(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load clipping campaigns')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [])

  const economics = useMemo(() => {
    const budget = Math.max(0, Number(form.budget) || 0)
    const rate = Math.max(5, Math.min(50, Number(form.agencyRate) || 20)) / 100
    return {
      agencyRevenue: budget * rate,
      creatorPool: budget * (1 - rate),
    }
  }, [form.budget, form.agencyRate])

  const togglePlatform = (platform) => {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }))
  }

  const createCampaign = async (event) => {
    event.preventDefault()
    setError('')
    setWorkingId('new')
    try {
      const payload = {
        name: form.name,
        brief: form.brief,
        transcript: form.transcript,
        sourceUrl: form.sourceUrl,
        sourceDurationSeconds: Number(form.sourceDurationSeconds) || null,
        targetAudience: form.targetAudience,
        brandVoice: form.brandVoice,
        budget: Number(form.budget) || 0,
        agencyRate: (Number(form.agencyRate) || 20) / 100,
        maxClips: Number(form.maxClips) || 6,
        platforms: form.platforms,
        rightsManifest: {
          confirmedOwnership: form.rightsConfirmed,
          commercialUseAllowed: form.commercialUseAllowed,
          allowedPlatforms: form.platforms,
          territories: ['worldwide'],
        },
      }

      const created = await api.post('/clipping/campaigns', payload)
      await api.post(`/clipping/campaigns/${created.data.id}/plan`, {
        intervalMinutes: 180,
      })
      setForm(emptyForm)
      await loadCampaigns()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create clipping campaign')
    } finally {
      setWorkingId(null)
    }
  }

  const runAction = async (campaign, action, clipId = null) => {
    setError('')
    setWorkingId(clipId ? `${campaign.id}:${clipId}` : campaign.id)
    try {
      if (action === 'transcribe') {
        await api.post(`/clipping/campaigns/${campaign.id}/transcribe`, {})
      } else if (action === 'plan') {
        await api.post(`/clipping/campaigns/${campaign.id}/plan`, {})
      } else if (action === 'render') {
        await api.post(`/clipping/campaigns/${campaign.id}/render`, {})
      } else if (action === 'publish' && clipId) {
        await api.post(`/clipping/campaigns/${campaign.id}/publish/${clipId}`, {})
      } else if (action === 'activate') {
        await api.post(`/clipping/campaigns/${campaign.id}/activate`, {
          humanApprovalRequiredBeforeFirstPublish: false,
        })
      } else if (action === 'cycle') {
        await api.post(`/clipping/campaigns/${campaign.id}/run-cycle`, { batchSize: 1 })
      } else if (action === 'pause') {
        await api.post(`/clipping/campaigns/${campaign.id}/pause`, {})
      }
      await loadCampaigns()
    } catch (err) {
      const details = err.response?.data?.details
      setError(details?.join(' ') || err.response?.data?.error || 'Action failed')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Scissors size={24} style={{ color: 'var(--gold-bright)' }} />
            <h2 className="text-2xl font-bold">AI Clipping Agency</h2>
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Turn licensed long-form content into AI-planned short-form campaigns, creator budgets, posting schedules and optimization loops.
          </p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Automation model</div>
          <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
            <Bot size={16} style={{ color: 'var(--cyan)' }} />
            Plan → Schedule → Measure → Optimize
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={createCampaign} className="space-y-4 rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--gold)' }} />
            <h3 className="font-semibold">Create autonomous clipping campaign</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Campaign name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 bg-transparent"
                style={{ borderColor: 'var(--line)' }}
                placeholder="Product launch clips"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Target audience</span>
              <input
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 bg-transparent"
                style={{ borderColor: 'var(--line)' }}
                placeholder="Founders, creators, ecommerce brands"
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span>Campaign brief</span>
            <textarea
              required={!form.transcript && !form.sourceUrl}
              rows={3}
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 bg-transparent"
              style={{ borderColor: 'var(--line)' }}
              placeholder="What should the clips achieve, what is the offer, and what must the audience understand?"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span>Source video URL</span>
            <input
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 bg-transparent"
              style={{ borderColor: 'var(--line)' }}
              placeholder="https://..."
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span>Transcript or source notes</span>
            <textarea
              rows={5}
              value={form.transcript}
              onChange={(e) => setForm({ ...form, transcript: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 bg-transparent"
              style={{ borderColor: 'var(--line)' }}
              placeholder="Paste the transcript for timestamped AI clip planning. Media transcription/rendering can be attached to the worker next."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span>Budget</span>
              <input type="number" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="w-full rounded-lg border px-3 py-2 bg-transparent" style={{ borderColor: 'var(--line)' }} />
            </label>
            <label className="space-y-1 text-sm">
              <span>Agency cut %</span>
              <input type="number" min="5" max="50" value={form.agencyRate} onChange={(e) => setForm({ ...form, agencyRate: e.target.value })} className="w-full rounded-lg border px-3 py-2 bg-transparent" style={{ borderColor: 'var(--line)' }} />
            </label>
            <label className="space-y-1 text-sm">
              <span>AI clip count</span>
              <input type="number" min="1" max="12" value={form.maxClips} onChange={(e) => setForm({ ...form, maxClips: e.target.value })} className="w-full rounded-lg border px-3 py-2 bg-transparent" style={{ borderColor: 'var(--line)' }} />
            </label>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Platforms</div>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((platform) => {
                const active = form.platforms.includes(platform)
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    className="rounded-full px-3 py-1.5 text-sm"
                    style={{
                      background: active ? 'rgba(196,163,90,0.18)' : 'var(--bg-elev)',
                      color: active ? 'var(--gold-bright)' : 'var(--text-muted)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    {platform}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2 rounded-lg p-3" style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} style={{ color: 'var(--cyan)' }} />
              Rights gate
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.rightsConfirmed} onChange={(e) => setForm({ ...form, rightsConfirmed: e.target.checked })} />
              <span>I own this content or have explicit permission to clip and distribute it.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.commercialUseAllowed} onChange={(e) => setForm({ ...form, commercialUseAllowed: e.target.checked })} />
              <span>Commercial use, promotion and monetized campaign distribution are permitted.</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={workingId === 'new' || form.platforms.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold disabled:opacity-50"
            style={{ background: 'var(--gold)', color: '#111' }}
          >
            {workingId === 'new' ? <RefreshCw className="animate-spin" size={17} /> : <Sparkles size={17} />}
            Build campaign and AI clip plan
          </button>
        </form>

        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
            <div className="flex items-center gap-2">
              <DollarSign size={18} style={{ color: 'var(--cyan)' }} />
              <h3 className="font-semibold">Campaign economics</h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-elev)' }}>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Agency revenue</div>
                <div className="mt-1 text-xl font-bold">${economics.agencyRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-elev)' }}>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Creator / distribution pool</div>
                <div className="mt-1 text-xl font-bold">${economics.creatorPool.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-5 text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
            <h3 className="font-semibold">What the automation already handles</h3>
            <div className="mt-3 space-y-2" style={{ color: 'var(--text-muted)' }}>
              {[
                'Rights-gated campaign setup',
                'AI hook and clip-moment planning',
                'Platform-specific captions and hashtags',
                'Agency margin and creator-pool calculation',
                'Automatic posting timetable generation',
                'Campaign activation / pause controls',
                'Performance ingestion, CTR, conversion and ROAS calculation',
                'AI optimization recommendations from campaign results',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="mt-0.5 flex-none" style={{ color: 'var(--cyan)' }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Clipping campaigns</h3>
          <button onClick={loadCampaigns} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', color: 'var(--text-muted)' }}>
            Loading clipping campaigns…
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', color: 'var(--text-muted)' }}>
            No AI clipping campaigns yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <article key={campaign.id} className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">{campaign.name}</h4>
                    <p className="mt-1 text-xs uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
                      {campaign.status} · {campaign.clipPlan?.clips?.length || 0} clips
                    </p>
                  </div>
                  <div className="rounded-full px-2 py-1 text-xs" style={{ background: 'var(--bg-elev)', color: campaign.status === 'running' ? 'var(--cyan)' : 'var(--text-muted)' }}>
                    {campaign.status}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Budget</div>
                    <div className="font-semibold">${Number(campaign.economics?.totalBudget || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Agency</div>
                    <div className="font-semibold">${Number(campaign.economics?.agencyRevenue || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Creator pool</div>
                    <div className="font-semibold">${Number(campaign.economics?.creatorPool || 0).toLocaleString()}</div>
                  </div>
                </div>

                {campaign.optimization?.summary && (
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg p-3 text-xs" style={{ background: 'var(--bg-elev)' }}>
                    <div><span style={{ color: 'var(--text-dim)' }}>Views</span><div className="font-semibold">{campaign.optimization.summary.views.toLocaleString()}</div></div>
                    <div><span style={{ color: 'var(--text-dim)' }}>CTR</span><div className="font-semibold">{campaign.optimization.summary.ctr}%</div></div>
                    <div><span style={{ color: 'var(--text-dim)' }}>ROAS</span><div className="font-semibold">{campaign.optimization.summary.roas}x</div></div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {campaign.sourceUrl && (
                    <button
                      onClick={() => runAction(campaign, 'transcribe')}
                      disabled={workingId === campaign.id}
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                      style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
                    >
                      <FileAudio size={14} /> Transcribe
                    </button>
                  )}
                  <button
                    onClick={() => runAction(campaign, 'plan')}
                    disabled={workingId === campaign.id}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
                  >
                    <RefreshCw size={14} /> Re-plan
                  </button>
                  {campaign.sourceUrl && campaign.clipPlan?.clips?.length > 0 && (
                    <button
                      onClick={() => runAction(campaign, 'render')}
                      disabled={workingId === campaign.id}
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                      style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
                    >
                      <Film size={14} /> Render clips
                    </button>
                  )}
                  {campaign.status === 'running' ? (
                    <>
                      <button
                        onClick={() => runAction(campaign, 'cycle')}
                        disabled={workingId === campaign.id}
                        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                        style={{ background: 'rgba(6,182,212,0.12)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.25)' }}
                      >
                        <Bot size={14} /> Run automation
                      </button>
                      <button
                        onClick={() => runAction(campaign, 'pause')}
                        disabled={workingId === campaign.id}
                        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                        style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
                      >
                        <Pause size={14} /> Pause
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => runAction(campaign, 'activate')}
                      disabled={workingId === campaign.id || !campaign.clipPlan?.clips?.length}
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
                    >
                      <Play size={14} /> Activate
                    </button>
                  )}
                </div>

                {campaign.clipPlan?.clips?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {campaign.clipPlan.clips.slice(0, 3).map((clip) => (
                      <div key={clip.id} className="rounded-lg p-3 text-sm" style={{ background: 'var(--bg-elev)' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{clip.title}</div>
                            <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                              {clip.startSeconds}s–{clip.endSeconds}s · score {clip.qualityScore} · {clip.status}
                            </div>
                          </div>
                          {clip.mediaUrl && (
                            <button
                              onClick={() => runAction(campaign, 'publish', clip.id)}
                              disabled={workingId === `${campaign.id}:${clip.id}`}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                              style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
                            >
                              <Send size={12} /> Publish
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
