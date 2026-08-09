import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, PauseCircle, PlayCircle } from 'lucide-react'
import api from '../services/api'

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', platform: 'TikTok', budget: '' })

  useEffect(() => {
    api.get('/campaigns').then(res => setCampaigns(res.data))
  }, [])

  const handleCreate = (e) => {
    e.preventDefault()
    api.post('/campaigns', { ...form, budget: Number(form.budget) }).then(res => {
      setCampaigns(prev => [...prev, res.data])
      setShowForm(false)
      setForm({ name: '', platform: 'TikTok', budget: '' })
    })
  }

  const toggleStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'running' ? 'paused' : 'running'
    api.patch(`/campaigns/${id}`, { status: newStatus }).then(res => {
      setCampaigns(prev => prev.map(c => c.id === id ? res.data : c))
    })
  }

  const handleDelete = (id) => {
    api.delete(`/campaigns/${id}`).then(() => {
      setCampaigns(prev => prev.filter(c => c.id !== id))
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Campaigns</h2>
          <p className="text-gray-500 mt-1">Manage your marketing campaigns across all platforms</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={18} />
          New Campaign
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={form.platform}
                onChange={e => setForm({ ...form, platform: e.target.value })}
              >
                <option>TikTok</option>
                <option>Instagram</option>
                <option>Google</option>
                <option>YouTube</option>
                <option>Facebook</option>
                <option>LinkedIn</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget ($)</label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={form.budget}
                onChange={e => setForm({ ...form, budget: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Campaign</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Campaign</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Platform</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Budget</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Spend</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">ROI</th>
              <th className="text-center px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(c => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 text-gray-900 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.platform}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    c.status === 'running' ? 'bg-green-50 text-green-700' :
                    c.status === 'paused' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-900">${c.budget.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-600">${c.spend.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{c.roi}x</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => toggleStatus(c.id, c.status)} className="p-1 hover:bg-gray-100 rounded">
                      {c.status === 'running' ? <PauseCircle size={18} className="text-yellow-600" /> : <PlayCircle size={18} className="text-green-600" />}
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="p-1 hover:bg-gray-100 rounded">
                      <Trash2 size={18} className="text-red-600" />
                    </button>
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