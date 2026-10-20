import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowRight, Building2, CheckCircle2 } from 'lucide-react';

const initial = {
  company: '',
  website: '',
  industry: '',
  companySize: 'small',
  targetAudience: '',
  primaryOffer: '',
  businessDescription: '',
  primaryGoal: '',
  preferredTone: 'professional',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

export default function Onboarding() {
  const [form, setForm] = useState(initial);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.allSettled([
      api.get('/settings/profile'),
      api.get('/billing/subscription'),
    ]).then(([profileResult, subscriptionResult]) => {
      if (profileResult.status === 'fulfilled') {
        const data = profileResult.value.data || {};
        const profile = data.profile || {};
        setForm((current) => ({
          ...current,
          company: profile.company || '',
          website: profile.website || '',
          industry: profile.industry || '',
          companySize: profile.companySize || 'small',
          targetAudience: profile.targetAudience || '',
          primaryOffer: profile.primaryOffer || '',
          businessDescription: profile.businessDescription || '',
          primaryGoal: profile.primaryGoal || '',
          preferredTone: profile.preferredTone || 'professional',
          language: data.preferences?.language || 'en',
          timezone: data.preferences?.timezone || current.timezone,
        }));
      }
      if (subscriptionResult.status === 'fulfilled') setSubscription(subscriptionResult.value.data);
      setLoading(false);
    });
  }, []);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch('/settings/profile', {
        ...form,
        goals: form.primaryGoal ? [form.primaryGoal] : [],
        onboardingCompleted: subscription?.status === 'active',
      });

      if (subscription?.status === 'active') {
        await api.post('/orchestrator/profile', {
          industry: form.industry,
          companySize: form.companySize,
          goals: form.primaryGoal ? [form.primaryGoal] : [],
          preferredTone: form.preferredTone,
          language: form.language,
          timezone: form.timezone,
        });
        navigate('/dashboard/products');
      } else {
        navigate('/dashboard/billing');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save business setup.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-gray-500">Loading business setup…</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium"><Building2 size={16} /> Business setup</div>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">Tell the agency what you sell and who you want to reach</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">This context is saved to your account and used to pre-fill marketing work. You can change it later.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 bg-white dark:bg-gray-800 dark:border-gray-700"><CheckCircle2 size={16} className="text-green-600 mb-1" /><div className="font-medium dark:text-white">1. Business context</div><div className="text-xs text-gray-500">Saved below</div></div>
        <div className="rounded-lg border p-3 bg-white dark:bg-gray-800 dark:border-gray-700"><CheckCircle2 size={16} className={subscription?.status === 'active' ? 'text-green-600 mb-1' : 'text-gray-400 mb-1'} /><div className="font-medium dark:text-white">2. Active plan</div><div className="text-xs text-gray-500">{subscription?.status === 'active' ? `${subscription.plan || 'Marketing'} active` : 'Required before AI work'}</div></div>
        <div className="rounded-lg border p-3 bg-white dark:bg-gray-800 dark:border-gray-700"><ArrowRight size={16} className="text-gray-400 mb-1" /><div className="font-medium dark:text-white">3. Create marketing</div><div className="text-xs text-gray-500">Campaign, content and channel assets</div></div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <form onSubmit={save} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-200">Business name<input required value={form.company} onChange={update('company')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" placeholder="Acme Ltd" /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">Website<input type="url" value={form.website} onChange={update('website')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" placeholder="https://example.com" /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">Industry<input required value={form.industry} onChange={update('industry')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" placeholder="e.g. SaaS, retail, construction" /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">Business size<select value={form.companySize} onChange={update('companySize')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent"><option value="solo">Solo</option><option value="small">2–20 people</option><option value="medium">21–200 people</option><option value="large">201+ people</option></select></label>
        </div>

        <label className="block text-sm text-gray-700 dark:text-gray-200">What does the business do?<textarea required rows={3} value={form.businessDescription} onChange={update('businessDescription')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" placeholder="Explain it in normal language." /></label>
        <label className="block text-sm text-gray-700 dark:text-gray-200">Main offer or product<textarea required rows={2} value={form.primaryOffer} onChange={update('primaryOffer')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" placeholder="What do you want customers to buy?" /></label>
        <label className="block text-sm text-gray-700 dark:text-gray-200">Ideal customer<textarea required rows={2} value={form.targetAudience} onChange={update('targetAudience')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" placeholder="Who is most likely to need this?" /></label>
        <label className="block text-sm text-gray-700 dark:text-gray-200">Primary marketing goal<input required value={form.primaryGoal} onChange={update('primaryGoal')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" placeholder="e.g. book qualified sales calls, sell 100 units, grow newsletter" /></label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-200">Brand tone<select value={form.preferredTone} onChange={update('preferredTone')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent"><option value="professional">Professional</option><option value="casual">Casual</option><option value="witty">Witty</option><option value="luxury">Luxury</option><option value="playful">Playful</option><option value="empathetic">Empathetic</option></select></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">Language<input value={form.language} onChange={update('language')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" placeholder="en" /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">Timezone<input value={form.timezone} onChange={update('timezone')} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" /></label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {subscription?.status !== 'active' && <p className="text-sm text-amber-700 dark:text-amber-300">Your business context will be saved first. Then choose a plan before AI generation.</p>}
          <div className="ml-auto flex gap-2">
            {subscription?.status === 'active' && <Link to="/dashboard" className="px-4 py-2 rounded-lg border text-sm">Skip for now</Link>}
            <button disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">
              {saving ? 'Saving…' : subscription?.status === 'active' ? 'Save & create marketing' : 'Save & choose plan'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
