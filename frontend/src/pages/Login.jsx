import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import { Mail, Lock, ArrowRight, Moon, Sun } from 'lucide-react';
import './landing.css';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
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
            <span className="studio-brand-name">
              <strong>TrillionAI</strong>
              <span>Tech</span>
            </span>
          </Link>
          <nav className="studio-nav">
            <LanguageSelector />
            <button type="button" onClick={toggleTheme} className="studio-nav-cta" style={{ background: 'transparent', cursor: 'pointer' }}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              {theme === 'dark' ? t('day') : t('night')}
            </button>
          </nav>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md studio-card">
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--gold-bright)', fontSize: '2rem', margin: 0 }}>{t('signIn')}</h1>
          {error && <div className="mt-4 p-3 text-sm text-red-400">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5" size={18} style={{ color: 'var(--gold)' }} />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-3 py-2 text-sm"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)' }}
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5" size={18} style={{ color: 'var(--gold)' }} />
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-3 py-2 text-sm"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)' }}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="studio-btn studio-btn-gold w-full">
              {loading ? '…' : t('signIn')}
              <ArrowRight size={16} />
            </button>
          </form>
          <div className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Link to="/register" style={{ color: 'var(--gold)' }}>{t('createAccount')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
