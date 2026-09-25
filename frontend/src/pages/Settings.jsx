import { useEffect, useState } from 'react';
import api from '../services/api';
import { ArrowLeft, Database, LockKeyhole, Save, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

function hourLabel(hour) {
  const value = Number(hour);
  if (value === 0) return '12 AM';
  if (value === 12) return '12 PM';
  return value < 12 ? value + ' AM' : (value - 12) + ' PM';
}

export default function Settings() {
  const { setTheme } = useTheme();
  const { setLang, langs } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [memory, setMemory] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [profileRes, memoryRes] = await Promise.all([
        api.get('/settings/profile'),
        api.get('/settings/account-memory'),
      ]);
      const loaded = profileRes.data;
      const preferences = loaded.preferences || {};
      setProfile(loaded);
      setMemory(memoryRes.data);
      setForm({
        firstName: loaded.profile?.firstName || '',
        lastName: loaded.profile?.lastName || '',
        company: loaded.profile?.company || '',
        language: preferences.language || 'en',
        timezone: preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        theme: preferences.theme || 'system',
        postingWindowStartHour: preferences.postingWindowStartHour ?? 8,
        postingWindowEndHour: preferences.postingWindowEndHour ?? 21,
        aiOptimizationEnabled: preferences.aiOptimizationEnabled !== false,
        emailNotifications: preferences.emailNotifications !== false,
        marketingNotifications: preferences.marketingNotifications !== false,
        dashboard: preferences.dashboard || { compactMode: false, showTips: true },
      });
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load account settings');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await api.patch('/settings/profile', form);
      setProfile(res.data);
      setTheme(form.theme);
      setLang(form.language);
      setMessage('Your account settings have been saved securely.');
      const memoryRes = await api.get('/settings/account-memory');
      setMemory(memoryRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save account settings');
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return <div className="p-8 text-sm text-gray-500">Loading your account settings…</div>;
  }

  const savedData = memory?.savedData || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/" className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Account & Privacy</h1>
            <p className="mt-1 text-sm text-gray-500">
              Your saved settings, automation preferences and marketing history belong to your account.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Save size={18} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Saved account preferences</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-gray-600 dark:text-gray-300">First name</span>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600 dark:text-gray-300">Last name</span>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600 dark:text-gray-300">Company</span>
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600 dark:text-gray-300">Language</span>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
                >
                  {langs.map((item) => (
                    <option key={item.code} value={item.code}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600 dark:text-gray-300">Time zone</span>
                <input
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600 dark:text-gray-300">Theme</span>
                <select
                  value={form.theme}
                  onChange={(e) => setForm({ ...form, theme: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
                >
                  <option value="system">Use device setting</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-900 dark:text-white">Default automated posting hours</div>
              <p className="mt-1 text-xs text-gray-500">These preferences are saved to your account and can be used as defaults for new automation plans.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Start</span><strong>{hourLabel(form.postingWindowStartHour)}</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="23"
                    value={form.postingWindowStartHour}
                    onChange={(e) => setForm({ ...form, postingWindowStartHour: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 flex justify-between text-gray-600 dark:text-gray-300">
                    <span>End</span><strong>{hourLabel(form.postingWindowEndHour)}</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="23"
                    value={form.postingWindowEndHour}
                    onChange={(e) => setForm({ ...form, postingWindowEndHour: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['aiOptimizationEnabled', 'AI marketing optimization'],
                ['emailNotifications', 'Account email notifications'],
                ['marketingNotifications', 'Marketing performance notifications'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(form[key])}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving securely…' : 'Save my account settings'}
            </button>
          </section>

          <div className="space-y-6">
            <section className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950/20">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <ShieldCheck size={20} />
                <h2 className="font-semibold">Account privacy</h2>
              </div>
              <div className="mt-3 space-y-2 text-xs leading-5 text-green-800 dark:text-green-300">
                <p>Your preferences are encrypted before they are stored.</p>
                <p>Your social connection tokens are encrypted and separated by your user ID.</p>
                <p>Your private source photos and videos use short-lived signed access links instead of permanent public media links.</p>
                <p>Marketing data queries are scoped to your authenticated account.</p>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-blue-600" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Saved to this account</h2>
              </div>
              <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex justify-between"><span>Media/content</span><strong>{savedData.mediaAndGeneratedContent || 0}</strong></div>
                <div className="flex justify-between"><span>Auto-post plans</span><strong>{savedData.automatedPostingPlans || 0}</strong></div>
                <div className="flex justify-between"><span>Analytics records</span><strong>{savedData.analyticsRecords || 0}</strong></div>
                <div className="flex justify-between"><span>Campaigns</span><strong>{savedData.campaigns || 0}</strong></div>
                <div className="flex justify-between"><span>Leads</span><strong>{savedData.leads || 0}</strong></div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <LockKeyhole size={18} className="text-gray-700 dark:text-gray-300" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Account identity</h2>
              </div>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                <div>{profile?.email}</div>
                <div className="mt-1 capitalize">{profile?.role || 'user'}</div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
