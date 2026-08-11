import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ArrowLeft, ShieldCheck, Megaphone, Package, CreditCard, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { user, updateMarketingConsent } = useAuth();
  const [profile, setProfile] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [marketingLoading, setMarketingLoading] = useState(false);

  useEffect(() => {
    api.get('/settings/profile').then(res => setProfile(res.data)).catch(() => {});
    api.get('/billing/purchases').then(res => setPurchases(res.data || [])).catch(() => {});
    api.get('/billing/subscriptions').then(res => setSubscriptions(res.data || [])).catch(() => {});
  }, []);

  const handleMarketingToggle = async () => {
    if (!profile) return;
    setMarketingLoading(true);
    try {
      const newVal = !profile.marketingConsent?.optedIn;
      const res = await updateMarketingConsent(newVal);
      setProfile(prev => ({ ...prev, marketingConsent: res.marketingConsent }));
    } catch (err) {
      console.error(err);
    } finally {
      setMarketingLoading(false);
    }
  };

  const handleCancel = async (purchaseId) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return;
    try {
      await api.post('/billing/cancel', { purchaseId });
      const res = await api.get('/billing/subscriptions');
      setSubscriptions(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const currentMarketing = profile?.marketingConsent?.optedIn || false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile */}
          {profile && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <div className="text-gray-900 dark:text-white">{profile.email}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <div className="text-gray-900 dark:text-white capitalize">{profile.role}</div>
                </div>
                {profile.profile && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                      <div className="text-gray-900 dark:text-white">
                        {profile.profile.firstName} {profile.profile.lastName}
                      </div>
                    </div>
                  </>
                )}
                {profile.agreements && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <ShieldCheck size={14} />
                      <span>Agreed to Terms of Service v{profile.agreements.terms?.versionId?.split('-v')?.[1] || '1.0'}</span>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {profile.agreements.terms?.agreedAt ? new Date(profile.agreements.terms.agreedAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Marketing Consent */}
          {profile && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Megaphone size={18} className="text-blue-500" />
                Marketing Preferences
              </h2>
              <div className="flex items-start gap-3">
                <input
                  id="settingsMarketing"
                  type="checkbox"
                  checked={currentMarketing}
                  onChange={handleMarketingToggle}
                  disabled={marketingLoading}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="settingsMarketing" className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  Yes, I'd like to receive product news, updates and offers from Trillion AI Tech.
                </label>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 pl-7">
                You can withdraw this consent at any time. Account communications remain separate.
              </p>
            </div>
          )}

          {/* Purchased Products */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Package size={18} className="text-blue-500" />
              Purchased Products
            </h2>
            {purchases.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No products purchased yet. <Link to="/products" className="text-blue-600 hover:underline">Browse products</Link>.</p>
            ) : (
              <div className="space-y-3">
                {purchases.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{p.productName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {p.currency} {p.price} · {p.billingType} · {p.status}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        Purchased {new Date(p.purchasedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Subscriptions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-blue-500" />
              Subscriptions
            </h2>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No active subscriptions.</p>
            ) : (
              <div className="space-y-3">
                {subscriptions.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{s.productName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {s.currency} {s.price}/{s.billingInterval} · {s.status}
                      </div>
                    </div>
                    {s.status === 'active' && (
                      <button
                        onClick={() => handleCancel(s.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <X size={12} /> Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
