import { useEffect, useState } from 'react';
import api from '../services/api';
import { ArrowLeft, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState({});
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState({});
  const [running, setRunning] = useState({});

  useEffect(() => {
    api.get('/agents').then(res => {
      setAgents(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const runAgent = async (agent) => {
    const key = agent.id || agent.agentId;
    const task = String(tasks[key] || '').trim();
    if (!task) {
      setErrors(prev => ({ ...prev, [key]: 'Enter a task for this agent.' }));
      return;
    }

    setRunning(prev => ({ ...prev, [key]: true }));
    setErrors(prev => ({ ...prev, [key]: '' }));
    setResults(prev => ({ ...prev, [key]: null }));

    try {
      const response = await api.post(`/agents/${key}/execute`, { task });
      setResults(prev => ({ ...prev, [key]: response.data }));
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [key]: error.response?.data?.error || 'This AI agent could not complete the task.',
      }));
    } finally {
      setRunning(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Back to dashboard">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Agents</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Give an available specialist a real marketing task. Usage counts toward your plan's monthly AI allowance.</p>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">No AI agents are available on your current plan.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => {
              const key = agent.id || agent.agentId;
              const response = results[key];
              return (
                <div key={key} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Zap size={20} className="text-blue-600 dark:text-blue-400" />
                    <h3 className="font-medium text-gray-900 dark:text-white">{agent.name}</h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{agent.role}</p>
                  <span className={`self-start px-2 py-1 rounded-full text-xs font-medium ${
                    agent.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>{agent.status}</span>

                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor={`agent-task-${key}`}>Task for {agent.name}</label>
                  <textarea
                    id={`agent-task-${key}`}
                    aria-label={`Task for ${agent.name}`}
                    value={tasks[key] || ''}
                    onChange={(event) => setTasks(prev => ({ ...prev, [key]: event.target.value }))}
                    rows={4}
                    placeholder="Example: Write three launch-post variations for our new service."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => runAgent(agent)}
                    disabled={Boolean(running[key])}
                    className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {running[key] ? `Running ${agent.name}…` : `Run ${agent.name}`}
                  </button>

                  {errors[key] && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">{errors[key]}</div>
                  )}
                  {response?.result && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Result</div>
                      <div className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100">{response.result}</div>
                      {response.usage?.total_tokens != null && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{Number(response.usage.total_tokens).toLocaleString()} tokens used</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
