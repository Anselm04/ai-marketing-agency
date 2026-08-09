import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';

function RecommendationCard({ rec, onAccept, onSelect }) {
  const [selected, setSelected] = useState(false);
  const { type, title, description, budget, platforms, timeline, priority } = rec;

  return (
    <div className={`border rounded-lg p-4 mb-4 transition ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${priority === 'high' ? 'bg-red-100 text-red-700' : priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
          {priority}
        </span>
      </div>
      <div className="flex gap-4 mt-3 text-sm text-gray-500">
        <span>Budget: ${budget}</span>
        <span>Platforms: {platforms?.join(', ')}</span>
        <span>Timeline: {timeline}</span>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => { setSelected(!selected); onSelect(rec, !selected); }}
          className={`text-sm px-3 py-1 rounded border ${selected ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          {selected ? 'Selected' : 'Select'}
        </button>
        <button onClick={() => onAccept(rec)} className="text-sm px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">
          Accept
        </button>
      </div>
    </div>
  );
}

export default function RecommendationsPage() {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [selected, setSelected] = useState([]);
  const [context, setContext] = useState({ product: '', budget: 1000, category: 'other', platforms: [], targetAudience: '' });
  const [showWizard, setShowWizard] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecommendations();
  }, []);

  async function fetchRecommendations() {
    try {
      const res = await api.get('/recommendations/campaigns');
      setRecommendations(res.data || []);
    } catch (err) {
      console.error('Failed to fetch recommendations', err);
    } finally {
      setLoading(false);
    }
  }

  async function generateRecommendations() {
    setLoading(true);
    try {
      const res = await api.post('/recommendations/campaigns', context);
      setRecommendations(res.data || []);
      setShowWizard(false);
    } catch (err) {
      console.error('Failed to generate recommendations', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(rec, isSelected) {
    if (isSelected) {
      setSelected(prev => [...prev, rec]);
    } else {
      setSelected(prev => prev.filter(r => r.id !== rec.id));
    }
  }

  async function acceptAll() {
    const toAccept = selected.length > 0 ? selected : recommendations;
    for (const rec of toAccept) {
      try {
        await api.post('/recommendations/accept', { recommendationId: rec.id });
      } catch (err) {
        console.error('Failed to accept', rec.id, err);
      }
    }
    navigate('/campaigns');
  }

  if (loading && !recommendations.length) {
    return (
      <Layout>
        <div className="p-8">
          <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="animate-pulse h-32 bg-gray-100 rounded"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Campaign Recommendations</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowWizard(true)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Generate New</button>
            <button onClick={acceptAll} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {selected.length > 0 ? `Accept ${selected.length} Selected` : 'Accept All'}
            </button>
          </div>
        </div>

        {showWizard && (
          <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Campaign Wizard</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Product Name</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={context.product}
                  onChange={e => setContext({ ...context, product: e.target.value })}
                  placeholder="e.g. SaaS CRM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Budget ($)</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={context.budget}
                  onChange={e => setContext({ ...context, budget: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={context.category}
                  onChange={e => setContext({ ...context, category: e.target.value })}
                >
                  <option value="technology">Technology</option>
                  <option value="fashion">Fashion</option>
                  <option value="health">Health</option>
                  <option value="finance">Finance</option>
                  <option value="education">Education</option>
                  <option value="food">Food</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target Audience</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={context.targetAudience}
                  onChange={e => setContext({ ...context, targetAudience: e.target.value })}
                  placeholder="e.g. small business owners"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={generateRecommendations} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Generate Recommendations</button>
              <button onClick={() => setShowWizard(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        )}

        {recommendations.length === 0 && !showWizard && (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-4">No recommendations yet. Generate a new campaign strategy.</p>
            <button onClick={() => setShowWizard(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Get Started</button>
          </div>
        )}

        {recommendations.map((rec, i) => (
          <RecommendationCard key={rec.id || i} rec={rec} onAccept={() => {}} onSelect={handleSelect} />
        ))}
      </div>
    </Layout>
  );
}
