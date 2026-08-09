import { useEffect, useState } from 'react'
import { Users, Plus, TrendingUp, Filter, Search, Phone, Mail, MessageCircle, Calendar } from 'lucide-react'
import api from '../services/api'

export default function CRM() {
  const [leads, setLeads] = useState([])
  const [pipeline, setPipeline] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', company: '', source: 'organic', status: 'new', notes: '' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [leadsRes, pipelineRes, analyticsRes] = await Promise.all([
      api.get('/crm/leads'),
      api.get('/crm/pipeline'),
      api.get('/crm/analytics'),
    ])
    setLeads(leadsRes.data)
    setPipeline(pipelineRes.data)
    setAnalytics(analyticsRes.data)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const res = await api.post('/crm/leads', form)
    setLeads(prev => [res.data, ...prev])
    setShowForm(false)
    setForm({ firstName: '', lastName: '', email: '', company: '', source: 'organic', status: 'new', notes: '' })
    fetchData()
  }

  const handleScore = async (id) => {
    await api.post(`/crm/leads/${id}/score`)
    fetchData()
  }

  const handleQualify = async (id) => {
    await api.post(`/crm/leads/${id}/qualify`)
    fetchData()
  }

  const handleRespond = async (id) => {
    await api.post(`/crm/leads/${id}/respond`)
    fetchData()
  }

  const statusColors = {
    new: 'bg-gray-100 text-gray-700',
    contacted: 'bg-blue-50 text-blue-700',
    qualified: 'bg-purple-50 text-purple-700',
    proposal: 'bg-yellow-50 text-yellow-700',
    negotiation: 'bg-orange-50 text-orange-700',
    closed_won: 'bg-green-50 text-green-700',
    closed_lost: 'bg-red-50 text-red-700',
  }

  const filtered = leads.filter(l => `${l.firstName} ${l.lastName} ${l.email}`.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CRM</h2>
          <p className="text-gray-500 mt-1">Manage leads and customer relationships</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={18} />
          Add Lead
        </button>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">New Leads (30d)</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.newLeads}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Converted</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.converted}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Conversion Rate</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.conversionRate.toFixed(1)}%</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Total Value</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">${analytics.totalValue.toLocaleString()}</div>
          </div>
        </div>
      )}

      {pipeline && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Pipeline</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(pipeline).map(([stage, data]) => (
              <div key={stage} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 capitalize">{stage.replace('_', ' ')}</div>
                <div className="text-lg font-bold text-gray-900 mt-1">{data.count}</div>
                <div className="text-xs text-gray-400">${data.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Company</label><input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Source</label><select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}><option>organic</option><option>ads</option><option>social</option><option>referral</option><option>affiliate</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>new</option><option>contacted</option><option>qualified</option><option>proposal</option><option>negotiation</option><option>closed_won</option><option>closed_lost</option></select></div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Lead</button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        <input type="text" placeholder="Search leads..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Lead</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Score</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Source</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l._id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{l.firstName} {l.lastName}</div>
                  <div className="text-xs text-gray-500">{l.email} &middot; {l.company}</div>
                </td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[l.status]}`}>{l.status.replace('_', ' ')}</span></td>
                <td className="px-4 py-3 text-gray-700">{l.score || 0}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{l.source}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleScore(l._id)} className="p-1 hover:bg-gray-100 rounded" title="Score"><TrendingUp size={16} className="text-blue-600" /></button>
                    <button onClick={() => handleQualify(l._id)} className="p-1 hover:bg-gray-100 rounded" title="Qualify"><Filter size={16} className="text-purple-600" /></button>
                    <button onClick={() => handleRespond(l._id)} className="p-1 hover:bg-gray-100 rounded" title="Auto Respond"><MessageCircle size={16} className="text-green-600" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
