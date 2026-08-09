import { useEffect, useState } from 'react';
import api from '../services/api';
import { ArrowLeft, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/agents').then(res => {
      setAgents(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Agents</h1>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <Zap size={20} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="font-medium text-gray-900 dark:text-white">{agent.name}</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{agent.role}</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  agent.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>{agent.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
