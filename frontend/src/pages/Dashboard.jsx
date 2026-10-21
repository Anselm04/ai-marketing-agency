import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Layout, BarChart3, Users, FileText, Zap, Settings } from 'lucide-react';

function limitLabel(value, unlimited) {
  if (unlimited || value == null) return 'Unlimited';
  return Number(value).toLocaleString();
}

function usageLabel(used, limit, unlimited) {
  return `${Number(used || 0).toLocaleString()} / ${limitLabel(limit, unlimited)}`;
}

function verifiedMoney(value) {
  return value == null ? 'Not verified' : `$${Number(value).toLocaleString()}`;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    api.get('/analytics').then(res => setStats(res.data)).catch(() => {});
    api.get('/usage').then(res => setUsage(res.data)).catch(() => {});
  }, []);

  const navItems = [
    { to: '/dashboard/campaigns', label: 'Campaigns', icon: Zap },
    { to: '/dashboard/agents', label: 'Agents', icon: Layout },
    { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/dashboard/content', label: 'Content', icon: FileText },
    { to: '/dashboard/crm', label: 'CRM', icon: Users },
    { to: '/dashboard/settings', label: 'Settings', icon: Settings },
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
              <div className="text-sm text-gray-500 dark:text-gray-400">Verified revenue</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{verifiedMoney(stats.revenue)}</div>
              {stats.revenue == null && Number(stats.reportedRevenue || 0) > 0 && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">${Number(stats.reportedRevenue).toLocaleString()} reported manually/unverified</div>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Verified spend</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{verifiedMoney(stats.spend)}</div>
              {stats.spend == null && Number(stats.reportedSpend || 0) > 0 && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">${Number(stats.reportedSpend).toLocaleString()} reported manually/unverified</div>
              )}
            </div>
          </div>
        )}

        {usage && (
          <section className="mb-8" aria-labelledby="plan-usage-heading">
            <div className="flex items-end justify-between gap-4 mb-3">
              <div>
                <h2 id="plan-usage-heading" className="text-lg font-semibold text-gray-900 dark:text-white">Plan usage</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{usage.plan} plan · measured usage</p>
              </div>
              <Link to="/dashboard/billing" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Manage plan</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">AI tokens this month</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{usageLabel(usage.usage?.aiTokensMonth, usage.limits?.monthlyAiTokens, usage.unlimited)}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">Published posts today</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{usageLabel(usage.usage?.socialPostsDay, usage.limits?.postsPerDay, usage.unlimited)}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">Active campaigns</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{usageLabel(usage.usage?.activeCampaigns, usage.limits?.campaigns, usage.unlimited)}</div>
              </div>
            </div>
          </section>
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
