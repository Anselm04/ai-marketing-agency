import { useEffect, useState } from 'react'
import { Users, Plus, TrendingUp, Filter, Search, Phone, Mail, MessageCircle, Calendar, AlertTriangle, Inbox } from 'lucide-react'
import api from '../services/api'
import { SkeletonCard, SkeletonList } from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'
import { useToast } from '../context/ToastContext'

export default function CRM() {
  const [leads, setLeads] = useState([])
  const [pipeline, setPipeline] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', company: '', source: 'organic', status: 'new', notes: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { addToast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [leadsRes, pipelineRes, analyticsRes] = await Promise.all([
        api.get('/crm/leads'),
        api.get('/crm/pipeline'),
        api.get('/crm/analytics'),
      ])
      setLeads(leadsRes.data)
      setPipeline(pipelineRes.data)
      setAnalytics(analyticsRes.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load CRM data')
      addToast('Failed to load CRM data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const res = await api.post('/crm/leads', form)
      setLeads(prev => [res.data, ...prev])
      setShowForm(false)
      setForm({ firstName: '', lastName: '', email: '', company: '', source: 'organic', status: 'new', notes: '' })
      fetchData()
      addToast('Lead created successfully', 'success')
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to create lead', 'error')
    }
  }

  const handleScore = async (id) => {
    try {
      await api.post(`/crm/leads/${id}/score`)
      fetchData()
      addToast('Lead scored successfully', 'success')
    } catch (err) {
      addToast('Failed to score lead', 'error')
    }
  }

  const handleQualify = async (id) => {
    try {
      await api.post(`/crm/leads/${id}/qualify`)
      fetchData()
      addToast('Lead qualified', 'success')
    } catch (err) {
      addToast('Failed to qualify lead', 'error')
    }
  }

  const handleRespond = async (id) => {
    try {
      await api.post(`/crm/leads/${id}/respond`)
      fetchData()
      addToast('Auto-response sent', 'success')
    } catch (err) {
      addToast('Failed to respond', 'error')
    }
  }

  const statusColors = {
    new: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    contacted: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    qualified: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    proposal: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    negotiation: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    closed_won: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    closed_lost: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  }

  const filtered = leads.filter(l => `${l.firstName} ${l.lastName} ${l.email}`.toLowerCase().includes(filter.toLowerCase()))

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <SkeletonCard />
        <SkeletonList count={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Something went wrong</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CRM</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage leads and customer relationships</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={18} />
          Add Lead
        </button>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">New Leads (30d)</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{analytics.newLeads}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Converted</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{analytics.converted}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Conversion Rate</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{analytics.conversionRate.toFixed(1)}%</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Value</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">${analytics.totalValue.toLocaleString()}</div>
          </div>
        </div>
      )}

      {pipeline && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Pipeline</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(pipeline).map(([stage, data]) => (
              <div key={stage} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{stage.replace('_', ' ')}</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{data.count}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">${data.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label><input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label><input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label><input type="email" required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label><input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source</label><select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}><option>organic</option><option>ads</option><option>social</option><option>referral</option><option>affiliate</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label><select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>new</option><option>contacted</option><option>qualified</option><option>proposal</option><option>negotiation</option><option>closed_won</option><option>closed_lost</option></select></div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Lead</button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        <input type="text" placeholder="Search leads..." className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      {leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Start building your pipeline by adding your first lead."
          actionLabel="Add Lead"
          onAction={() => setShowForm(true)}
          icon={Inbox}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Lead</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Source</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l._id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{l.firstName} {l.lastName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{l.email} &middot; {l.company}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[l.status]}`}>{l.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{l.score || 0}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{l.source}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleScore(l._id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Score"><TrendingUp size={16} className="text-blue-600 dark:text-blue-400" /></button>
                      <button onClick={() => handleQualify(l._id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Qualify"><Filter size={16} className="text-purple-600 dark:text-purple-400" /></button>
                      <button onClick={() => handleRespond(l._id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Auto Respond"><MessageCircle size={16} className="text-green-600 dark:text-green-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
