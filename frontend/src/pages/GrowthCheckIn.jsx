import { useEffect, useState } from 'react'
import api from '../services/api'
import { ArrowLeft, ChartNoAxesCombined, ShieldCheck, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

const options = [
  { value: 'none', name: 'Keep business results private', detail: 'No check-ins. Your campaigns can still use available marketing analytics.' },
  { value: 'summary', name: 'Share simple progress', detail: 'Thumbs up/down or a five-point scale. No sales totals or revenue.' },
  { value: 'counts', name: 'Share changes in customer numbers', detail: 'Optionally report how many more or fewer paying customers you served.' },
]
const defaultSettings = { level: 'none', cadence: 'off' }
function currentPeriod(cadence) {
  const now = new Date()
  const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  return cadence === 'weekly' ? iso : iso.slice(0, 7)
}
export default function GrowthCheckIn() {
  const [settings, setSettings] = useState(defaultSettings)
  const [activeSettings, setActiveSettings] = useState(defaultSettings)
  const [reports, setReports] = useState([])
  const [form, setForm] = useState({ method: 'direction', value: 'same', note: '' })
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [assessment, setAssessment] = useState(null)
  const [recommendationReviews, setRecommendationReviews] = useState({})
  const [assessmentBusy, setAssessmentBusy] = useState(false)
  const [assessmentError, setAssessmentError] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    api.get('/settings/growth').then(({ data }) => {
      if (!live) return
      setSettings(data.settings || defaultSettings)
      setActiveSettings(data.settings || defaultSettings)
      setReports(data.reports || [])
      setLoading(false)
    }).catch(() => { if (live) { setError('Unable to load growth preferences.'); setLoading(false) } })
    return () => { live = false }
  }, [])
  const save = async () => {
    setError(''); setNotice(''); setBusy(true)
    try {
      const normalized = settings.level === 'none' ? { ...settings, cadence: 'off' } : settings
      const { data } = await api.put('/settings/growth/preferences', { ...normalized, understoodLimitations: ack })
      setSettings(data.settings); setActiveSettings(data.settings); setAssessment(null); setForm({method:'direction',value:'same',note:''}); setNotice('Your reporting preferences were saved.')
    } catch (e) { setError(e.response?.data?.error || 'Could not save preferences.') }
    finally { setBusy(false) }
  }
  const report = async (event) => {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const value = form.method === 'direction' ? form.value : Number(form.value)
      const { data } = await api.post('/settings/growth/reports', { period: currentPeriod(activeSettings.cadence), method: form.method, value, note: form.note })
      setReports((old) => [...old, data]); setAssessment(null); setNotice('Your private growth update was saved. It is not verified sales or revenue data.')
    } catch (e) { setError(e.response?.data?.error || 'Unable to save growth feedback.') }
    finally { setBusy(false) }
  }
  const requestAssessment = async () => {
    setAssessmentBusy(true); setAssessmentError('')
    try {
      const { data } = await api.post('/settings/manager-sync', {operation:'growth.assess',payload:{}})
      setAssessment(data); setRecommendationReviews({})
    } catch (e) {
      setAssessmentError(e.response?.data?.error || 'Manager recommendations are unavailable. Your existing marketing tools remain available.')
    } finally { setAssessmentBusy(false) }
  }
  const reviewRecommendation = async (code,decision) => {
    if(!assessment?.assessmentId) return
    setAssessmentBusy(true);setAssessmentError('')
    try {
      const {data} = await api.post('/settings/manager-sync', {
        operation:'growth.review',
        payload:{assessmentId:assessment.assessmentId,code,decision},
      })
      setRecommendationReviews(old=>({...old,[code]:data.status}))
    } catch (e) {
      setAssessmentError(e.response?.data?.error || 'The recommendation could not be reviewed. Refresh your assessment and try again.')
    } finally { setAssessmentBusy(false) }
  }
  const clearReports = async () => {
    if (!window.confirm('Delete all your saved growth check-ins? This cannot be undone.')) return
    setBusy(true);setError('');setNotice('')
    try { await api.delete('/settings/growth/reports');setReports([]);setAssessment(null);setNotice('Your saved check-ins were deleted.') }
    catch (e) { setError(e.response?.data?.error || 'Unable to delete check-ins.') }
    finally { setBusy(false) }
  }
  return <div className="max-w-3xl mx-auto space-y-5 text-gray-900 dark:text-gray-100">
    <div className="flex gap-3 items-start">
      <Link to="/dashboard/analytics" aria-label="Back to analytics" className="rounded-lg p-2 border dark:border-gray-700"><ArrowLeft size={19}/></Link>
      <div><p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2"><ChartNoAxesCombined size={17}/> CUSTOMER GROWTH</p>
        <h1 className="text-2xl font-bold">Your business growth check-in</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Help us understand how your marketing is going without disclosing your revenue. You control what you share.</p>
      </div>
    </div>
    {error && <div role="alert" className="p-3 border border-red-300 rounded-lg text-red-700 dark:text-red-300">{error}</div>}
    {notice && <p role="status" className="p-3 border border-green-300 rounded-lg text-green-800 dark:text-green-300">{notice}</p>}
    {loading ? <p>Loading your preferences…</p> : <>
      <section className="p-5 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-2"><ShieldCheck size={20}/><h2 className="font-semibold text-lg">Choose what to share</h2></div>
        {options.map((opt) => <label key={opt.value} className="flex gap-3 p-3 rounded-lg border dark:border-gray-700 cursor-pointer">
          <input type="radio" name="privacy" checked={settings.level === opt.value} onChange={() => { setSettings((old) => ({...old,level:opt.value,cadence:opt.value==='none'?'off':old.cadence==='off'?'monthly':old.cadence})); setAck(false) }} />
          <span><strong>{opt.name}</strong><span className="block text-sm text-gray-600 dark:text-gray-300">{opt.detail}</span></span>
        </label>)}
        {settings.level !== 'none' && <label className="block text-sm">How often?
          <select value={settings.cadence} onChange={(e) => { setSettings((s) => ({...s,cadence:e.target.value}));setAck(false) }} className="block mt-1 p-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700">
            <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
          </select>
        </label>}
        <p className="text-sm text-gray-600 dark:text-gray-300">More reliable information can improve recommendations, but does not guarantee more paying customers or revenue. We remain responsible for delivering the marketing service you purchased. You can change your choice later.</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} className="mt-1"/><span>I understand that limited business results restrict revenue-based measurement and optimisation. I choose my reporting level voluntarily.</span></label>
        <button type="button" disabled={busy || !ack} onClick={save} className="rounded-lg bg-blue-700 text-white px-4 py-2 disabled:opacity-50">Save my preferences</button>
      </section>
      {activeSettings.level !== 'none' && activeSettings.cadence !== 'off' && <section className="p-5 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 space-y-4">
        <h2 className="font-semibold text-lg">How did business go this {activeSettings.cadence === 'weekly' ? 'week' : 'month'}?</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Compared with a typical {settings.cadence === 'weekly' ? 'week' : 'month'}, what changed? Your answer is self-reported feedback, not independently verified revenue.</p>
        <form onSubmit={report} className="space-y-3">
          <label className="block text-sm">Reporting method
            <select value={form.method} onChange={e => setForm({method:e.target.value,value:e.target.value==='direction'?'same':e.target.value==='scale'?'3':'0',note:form.note})} className="block mt-1 p-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700">
              <option value="direction">More, fewer or about the same</option><option value="scale">Five-point growth scale</option>
              {activeSettings.level === 'counts' && <option value="count">Change in paying customer numbers</option>}
            </select>
          </label>
          {form.method==='direction' ? <fieldset className="flex gap-4 flex-wrap"><legend className="text-sm mb-2">Customer activity</legend>
            {[['up','More'],['same','About the same'],['down','Fewer']].map(([value,text])=><label key={value} className="flex items-center gap-1 text-sm"><input type="radio" checked={form.value===value} onChange={()=>setForm(s=>({...s,value}))}/>{text}</label>)}
          </fieldset> : form.method==='scale' ? <label className="block text-sm">1 = much lower · 3 = normal · 5 = much higher
            <input type="range" min="1" max="5" value={form.value} onChange={e=>setForm(s=>({...s,value:e.target.value}))} className="block w-full"/>
            <span>Selected: {form.value} / 5</span>
          </label> : <label className="block text-sm">Paying customer change (negative for fewer)
            <input type="number" step="1" min="-1000000" max="1000000" value={form.value} onChange={e=>setForm(s=>({...s,value:e.target.value}))} className="block p-2 mt-1 border dark:bg-gray-900 dark:border-gray-700 rounded-lg"/>
          </label>}
          <label className="block text-sm">Anything else we should know? (optional)
            <textarea maxLength={300} rows={2} value={form.note} onChange={e=>setForm(s=>({...s,note:e.target.value}))} className="block mt-1 w-full rounded-lg border p-2 dark:bg-gray-900 dark:border-gray-700" placeholder="Holiday, seasonal factors or customer feedback"/>
          </label>
          <button type="submit" disabled={busy} className="rounded-lg bg-blue-700 text-white px-4 py-2 disabled:opacity-50">Save my check-in</button>
        </form>
      </section>}
      <section className="p-5 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 space-y-3" aria-label="AI Manager recommendations">
        <div className="flex justify-between gap-2 flex-wrap items-center">
          <div><h2 className="font-semibold text-lg">Manager's marketing recommendations</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Optional advice based on results you choose to share. No campaigns or spending are changed automatically.</p></div>
          <button type="button" disabled={assessmentBusy} onClick={requestAssessment} className="rounded-lg border border-blue-600 text-blue-700 dark:text-blue-300 px-3 py-2 text-sm disabled:opacity-50">Review my results</button>
        </div>
        {assessmentError && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{assessmentError}</p>}
        {assessment && <div className="space-y-3" aria-live="polite">
          <p className="text-xs text-gray-500 dark:text-gray-400">Evidence confidence: {assessment.confidence} · {assessment.reportCount} voluntary check-ins · Revenue verified: no</p>
          <p className="text-sm">{assessment.message}</p>
          {(assessment.recommendations || []).map((item) => <article key={item.code} className="p-3 border dark:border-gray-700 rounded-lg space-y-2">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{item.reason}</p>
            {recommendationReviews[item.code]
              ? <p className="text-sm">Your choice: {recommendationReviews[item.code] === 'declined' ? 'Declined' : 'Approved for planning only — no task has been executed'}</p>
              : item.requiresCustomerApproval && <div className="flex gap-2 flex-wrap">
                <button type="button" disabled={assessmentBusy} onClick={()=>reviewRecommendation(item.code,'approve')} className="rounded-lg bg-blue-700 text-white px-3 py-2 text-sm disabled:opacity-50">Approve planning</button>
                <button type="button" disabled={assessmentBusy} onClick={()=>reviewRecommendation(item.code,'decline')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Not now</button>
              </div>}
          </article>)}
        </div>}
      </section>
      <section className="p-5 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 space-y-3">
        <div className="flex justify-between gap-3 flex-wrap items-center"><h2 className="font-semibold">Past check-ins ({reports.length})</h2>
        {reports.length>0&&<button type="button" disabled={busy} onClick={clearReports} className="flex items-center gap-1 text-sm text-red-600 disabled:opacity-50"><Trash2 size={15}/> Delete history</button>}</div>
        {reports.length===0 ? <p className="text-sm text-gray-500">No results shared yet. That's completely fine.</p> : <ul className="space-y-2">{[...reports].reverse().map((r)=><li key={r.period} className="border dark:border-gray-700 rounded-lg p-3 text-sm"><strong>{r.period}</strong> — {r.method==='direction'?r.value:r.method==='scale'?r.value+' out of 5':(r.value>0?'+':'')+r.value+' customers'}<span className="block text-xs text-gray-500">Self-reported, not verified revenue</span></li>)}</ul>}
      </section>
    </>}
  </div>
}
