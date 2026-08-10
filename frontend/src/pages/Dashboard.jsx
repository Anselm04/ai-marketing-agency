import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Layout, BarChart3, Users, FileText, Zap, Settings } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/analytics').then(res => setStats(res.data)).catch(() => {});
  }, []);

  const navItems = [
    { to: '/campaigns', label: 'Campaigns', icon: Zap },
    { to: '/agents', label: 'Agents', icon: Layout },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/content', label: 'Content', icon: FileText },
    { to: '/crm', label: 'CRM', icon: Users },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Campaigns</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.campaigns}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Leads</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.leads}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Revenue</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">${stats.revenue?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Spend</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">${stats.spend?.toLocaleString() || 0}</div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            >
              <item.icon size={20} className="text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-gray-900 dark:text-white">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
