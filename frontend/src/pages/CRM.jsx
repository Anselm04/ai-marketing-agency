import { useEffect, useState } from 'react';
import api from '../services/api';
import { ArrowLeft, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CRM() {
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    api.get('/crm/leads').then(res => setLeads(res.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CRM</h1>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={16} /> Add Lead
          </button>
        </div>
        {leads.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">No leads yet</div>
        ) : (
          <div className="grid gap-4">
            {leads.map(lead => (
              <div key={lead.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{lead.name || lead.email}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{lead.status} • {lead.company}</p>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Score: {lead.score || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
