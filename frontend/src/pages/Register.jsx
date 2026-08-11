import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Megaphone } from 'lucide-react';
import api from '../services/api';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [termsVersions, setTermsVersions] = useState({ terms: null, privacy: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/legal/terms-versions')
      .then(res => setTermsVersions({ terms: res.data.terms, privacy: res.data.privacy }))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!termsAgreed) {
      setError('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }
    if (!termsVersions.terms?.id || !termsVersions.privacy?.id) {
      setError('Terms and Privacy Policy information could not be loaded. Please refresh the page.');
      return;
    }
    setLoading(true);
    try {
      await register({
        ...form,
        termsAgreed: true,
        termsVersionId: termsVersions.terms.id,
        privacyVersionId: termsVersions.privacy.id,
        marketingConsent,
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trillion AI Tech</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create your free account</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Accounts are free. Product purchases are separate.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="text"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John"
                    value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Doe"
                  value={form.lastName}
                  onChange={e => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="password"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Must be at least 6 characters</p>
            </div>

            {/* Explicit Terms Agreement — not pre-selected, not bundled with marketing */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <input
                  id="termsAgreed"
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={e => setTermsAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="termsAgreed" className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  <ShieldCheck size={14} className="inline text-blue-500 mr-1" />
                  I agree to the{' '}
                  <Link to={`/legal/terms/${termsVersions.terms?.id || ''}`} target="_blank" className="text-blue-600 font-medium hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and acknowledge the{' '}
                  <Link to={`/legal/privacy/${termsVersions.privacy?.id || ''}`} target="_blank" className="text-blue-600 font-medium hover:underline">
                    Privacy Policy
                  </Link>.
                </label>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 pl-7">This is required to create your account.</p>
            </div>

            {/* Separate optional Marketing Consent — not pre-selected */}
            <div>
              <div className="flex items-start gap-3">
                <input
                  id="marketingConsent"
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={e => setMarketingConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="marketingConsent" className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  <Megaphone size={14} className="inline text-blue-500 mr-1" />
                  Yes, I'd like to receive product news, updates and offers from Trillion AI Tech.
                </label>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 pl-7">Optional. You can change this later in your account settings.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating account...' : 'Create free account'}
              <ArrowRight size={16} />
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
