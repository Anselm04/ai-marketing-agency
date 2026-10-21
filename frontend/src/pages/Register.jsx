import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import { Mail, Lock, User, ArrowRight, Moon, Sun } from 'lucide-react';
import './landing.css';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '', acceptedTerms: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!form.acceptedTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      await register(payload);
      navigate('/dashboard/billing');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="studio min-h-screen flex flex-col">
      <header className="studio-header">
        <div className="wrap">
          <Link className="studio-brand" to="/">
            <img src="/appforge-logo.png" width="36" height="36" alt="" />
            <span className="studio-brand-name"><strong>TrillionAI</strong><span>AI Marketing Agency</span></span>
          </Link>
          <nav className="studio-nav">
            <LanguageSelector />
            <button type="button" onClick={toggleTheme} className="studio-nav-cta" style={{ background: 'transparent', cursor: 'pointer' }}>
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              {isDark ? t('day') : t('night')}
            </button>
            <Link to="/login">{t('signIn')}</Link>
          </nav>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md studio-card">
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--gold-bright)', fontSize: '2rem', margin: 0 }}>{t('createAccount')}</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Create your customer workspace, then choose the plan that fits your marketing workload.</p>
          {error && <div className="mt-4 p-3 text-sm text-red-400">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{t('firstName')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5" size={18} style={{ color: 'var(--gold)' }} />
                  <input type="text" className="w-full pl-10 pr-3 py-2 text-sm" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)' }} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{t('lastName')}</label>
                <input type="text" className="w-full px-3 py-2 text-sm" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)' }} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{t('email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5" size={18} style={{ color: 'var(--gold)' }} />
                <input type="email" required className="w-full pl-10 pr-3 py-2 text-sm" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)' }} placeholder="you@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5" size={18} style={{ color: 'var(--gold)' }} />
                <input type="password" required minLength={8} className="w-full pl-10 pr-3 py-2 text-sm" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)' }} placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{t('confirmPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5" size={18} style={{ color: 'var(--gold)' }} />
                <input type="password" required minLength={8} className="w-full pl-10 pr-3 py-2 text-sm" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)' }} placeholder="••••••••" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" required checked={form.acceptedTerms} onChange={e => setForm({ ...form, acceptedTerms: e.target.checked })} className="mt-1" />
              <span>I agree to the <Link className="underline" to="/terms" target="_blank">Terms of Service</Link> and <Link className="underline" to="/privacy" target="_blank">Privacy Policy</Link>.</span>
            </label>
            <button type="submit" disabled={loading} className="studio-btn studio-btn-gold w-full">
              {loading ? '…' : t('createAccount')} <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
