import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, FileText, Megaphone, Users, Bot, ArrowRight } from 'lucide-react';
import api from '../services/api';

const entityIcons = {
  campaign: Megaphone,
  content: FileText,
  lead: Users,
  agent: Bot,
};

const entityPaths = {
  campaign: '/dashboard/campaigns',
  content: '/dashboard/content',
  lead: '/dashboard/crm',
  agent: '/dashboard/agents',
};

export default function SearchBar({ className = '' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/search', { params: { q: query } });
        setResults(res.data.results.slice(0, 8));
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setShowResults(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (item) => {
    setShowResults(false);
    setQuery('');
    navigate(entityPaths[item.entityType] || '/dashboard');
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          placeholder="Search campaigns, content, leads, agents..."
          className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); }} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        )}
      </div>

      {showResults && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          {loading ? (
            <div className="p-4 text-sm text-gray-500 text-center">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">No results found</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.map((item) => {
                const Icon = entityIcons[item.entityType] || FileText;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                      <Icon size={16} className="text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {item.name || item.title || `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.agentId || 'Untitled'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{item.entityType}</div>
                    </div>
                    <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
