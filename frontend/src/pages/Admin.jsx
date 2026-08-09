import { useEffect, useState } from 'react'
import { Shield, Users, Bot, Activity, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'
import api from '../services/api'

export default function Admin() {
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [health, setHealth] = useState([])
  const [review, setReview] = useState(null)
  const [optimize, setOptimize] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [ov, us, hl] = await Promise.all([
      api.get('/admin/overview'),
      api.get('/admin/users'),
      api.get('/admin/meta-agents/health'),
    ])
    setOverview(ov.data)
    setUsers(us.data)
    setHealth(hl.data)
  }

  const handleReview = async () => {
    const res = await api.get('/admin/meta-agents/review')
    setReview(res.data)
  }

  const handleOptimize = async () => {
    const res = await api.get('/admin/meta-agents/optimize')
    setOptimize(res.data)
  }

  const handleRetrain = async (agentId) => {
    await api.post(`/admin/meta-agents/retrain/${agentId}`, { feedback: 'Improve accuracy and reduce response time' })
    fetchData()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin</h2>
        <p className="text-gray-500 mt-1">System administration and meta-agent oversight</p>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Users</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{overview.users}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Campaigns</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{overview.campaigns}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Agents</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{overview.agents}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Tasks</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{overview.tasks}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Leads</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{overview.leads}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Subscriptions</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{overview.subscriptions}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Shield size={18} /> Overseer Review</h3>
            <button onClick={handleReview} className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"><RefreshCw size={14} /> Run</button>
          </div>
          {review && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle size={16} className="text-yellow-500" />
                <span className="text-gray-700">Flagged Agents: {review.flaggedAgents?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle size={16} className="text-yellow-500" />
                <span className="text-gray-700">Flagged Tasks: {review.flaggedTasks?.length || 0}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{review.review?.content || 'Review complete'}</div>
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Activity size={18} /> Agent Coordinator</h3>
            <button onClick={handleOptimize} className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"><RefreshCw size={14} /> Optimize</button>
          </div>
          {optimize && (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">Suggested task order: {optimize.suggestedOrder?.length || 0} tasks</div>
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{optimize.optimization?.content || 'Optimization complete'}</div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Bot size={18} /> Agent Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {health.map(agent => (
            <div key={agent.agentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                <div className="text-xs text-gray-500">{agent.agentId}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${agent.healthy ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {agent.healthy ? 'Healthy' : 'Issue'}
                </span>
                <button onClick={() => handleRetrain(agent.agentId)} className="p-1 hover:bg-gray-200 rounded" title="Retrain">
                  <RefreshCw size={14} className="text-blue-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Users size={18} /> Users</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Last Login</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-gray-900">{u.email}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">{u.role}</span></td>
                  <td className="px-4 py-3 text-gray-600">{u.profile?.company || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
