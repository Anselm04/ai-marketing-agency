import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ContentStudio() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [copied, setCopied] = useState(null);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setCopied(null);
    setCopyError('');
    api.get('/content', { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(data) || data.some((item) => !item || typeof item.id !== 'string')) {
        throw new Error('Invalid saved content response');
      }
      setItems(data);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load your saved content. Try again.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);

  const copyText = async (item) => {
    setCopied(null);
    setCopyError('');
    try {
      await navigator.clipboard.writeText(item.body);
      setCopied(item.id);
    } catch {
      setCopyError('Could not copy. Select the text and copy it manually.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" aria-label="Back to dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Studio</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your saved marketing content. Create new copy with the tools below.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/dashboard/products" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus size={16} /> Create marketing content
            </Link>
            <Link to="/dashboard/social" className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium">
              Create social posts
            </Link>
          </div>
        </div>

        {loading ? (
          <p role="status" className="text-gray-500 dark:text-gray-400">Loading saved content…</p>
        ) : error ? (
          <div className="space-y-3">
            <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>
            <button type="button" onClick={() => setReload((value) => value + 1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Try again</button>
          </div>
        ) : items.length === 0 ? (
          <p className="text-center py-12 text-gray-500 dark:text-gray-400">No saved content yet. Create marketing content to start your library.</p>
        ) : (
          <div className="space-y-4">
            {copyError && <p role="alert" className="text-red-600 dark:text-red-400">{copyError}</p>}
            {items.map((item) => (
              <article key={item.id} className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">{typeof item.title === 'string' && item.title ? item.title : 'Untitled content'}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {[item.type, item.platform, item.status].filter((value) => typeof value === 'string' && value).join(' · ')}
                    </p>
                  </div>
                  {typeof item.body === 'string' && item.body.trim() && (
                    <button type="button" onClick={() => copyText(item)} className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
                      <Copy size={14} /> {copied === item.id ? 'Copied' : 'Copy text'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                  {typeof item.body === 'string' && item.body.trim() ? item.body : 'Text preview is not available for this item.'}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
