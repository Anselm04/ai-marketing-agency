import { useEffect, useState } from 'react'
import { Play, Pause, Bot, Activity } from 'lucide-react'
import api from '../services/api'

export default function Agents() {
  const [agents, setAgents] = useState([])

  useEffect(() => {
    api.get('/agents').then(res => setAgents(res.data))
  }, [])

  const handleExecute = (id) => {
    api.post(`/agents/${id}/execute`, { task: 'manual-trigger' }).then(res => {
      setAgents(prev => prev.map(a => a.id === id ? res.data.agent : a))
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">AI Agents</h2>
        <p className="text-gray-500 mt-1">Manage and monitor your autonomous marketing agents</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Bot size={20} className="text-blue-600" />
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                agent.status === 'active'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {agent.status === 'active' ? 'Active' : 'Idle'}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 mt-3">{agent.name}</h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{agent.role}</p>
            <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
              <Activity size={14} />
              Last active: {new Date(agent.lastActive).toLocaleTimeString()}
            </div>
            <button
              onClick={() => handleExecute(agent.id)}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Play size={16} />
              Execute Now
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}