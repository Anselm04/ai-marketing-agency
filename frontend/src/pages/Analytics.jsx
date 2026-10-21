import { useEffect, useState } from 'react';
import api from '../services/api';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

function money(value) {
  return value == null ? 'Not verified' : `$${Number(value).toLocaleString()}`;
}

export default function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/analytics/dashboard').then(res => setData(res.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Back to dashboard">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Provider-verified performance is separated from manually reported campaign values.</p>
          </div>
        </div>
        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Campaigns</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.totalCampaigns}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">Active Campaigns</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{data.activeCampaigns}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">Verified ROI</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {data.overallRoi == null ? 'Unavailable' : `${(data.overallRoi * 100).toFixed(0)}%`}
                </div>
                {data.overallRoi == null && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Needs provider-verified revenue and spend for the same campaign.</div>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">Verified revenue</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{money(data.totalRevenue)}</div>
                {Number(data.reportedRevenue || 0) > 0 && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Reported/manual total: ${Number(data.reportedRevenue).toLocaleString()}</div>}
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">Verified spend</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{money(data.totalSpend)}</div>
                {Number(data.reportedSpend || 0) > 0 && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Reported/manual total: ${Number(data.reportedSpend).toLocaleString()}</div>}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm text-gray-600 dark:text-gray-300">
              <strong>Performance provenance:</strong> {data.provenance?.note || 'Only verified provider data is treated as measured performance.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
