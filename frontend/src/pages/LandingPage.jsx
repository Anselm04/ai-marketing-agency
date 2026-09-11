import { Link } from 'react-router-dom'
import { CATALOG } from '../config/stripeCatalog'
import { APPFORGE_URL, BRAND_URL } from '../config/library'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import LanguageSelector from '../components/LanguageSelector'
import './landing.css'

const dollars = (item) => item.amount / 100

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()

  return (
    <div className="studio">
      <header className="studio-header">
        <div className="wrap">
          <a className="studio-brand" href={BRAND_URL} target="_blank" rel="noreferrer">
            <img src="/marketing-logo.svg" width="36" height="36" alt="TrillionAI Marketing" />
            <span className="studio-brand-name">
              <strong>TrillionAI Marketing</strong>
              <span>Tech</span>
            </span>
          </a>
          <nav className="studio-nav" aria-label="Primary">
            <a className="hide-sm" href="#pricing">{t('pricing')}</a>
            <LanguageSelector />
            <button type="button" onClick={toggleTheme} className="studio-nav-cta" aria-label={theme === 'dark' ? t('day') : t('night')} style={{ border: '1px solid var(--gold)', background: 'transparent', cursor: 'pointer' }}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span className="hide-sm">{theme === 'dark' ? t('day') : t('night')}</span>
            </button>
            <Link className="studio-btn studio-btn-ghost" to="/login">{t('signIn')}</Link>
            <Link className="studio-btn studio-btn-gold" to="/register">{t('getStarted')}</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="studio-hero">
          <div className="wrap">
            <p className="studio-kicker">TrillionAI Marketing</p>
            <h1>Sign in. Pick a product. Hit Start campaign.</h1>
            <p className="studio-lede">Sign in. Pick a product. Hit Start campaign.</p>
            <div className="studio-actions">
              <Link className="studio-btn studio-btn-gold" to="/login">{t('signIn')}</Link>
              <Link className="studio-btn studio-btn-ghost" to="/register">{t('getStarted')}</Link>
            </div>
          </div>
        </section>

        <section className="studio-section" id="pricing">
          <div className="wrap">
            <header className="studio-head">
              <p className="studio-kicker">{t('heroKicker')}</p>
              <h2>{t('pricing')}</h2>
            </header>
            <div className="studio-plans">
              {CATALOG.plans.map((plan) => (
                <article className={`studio-plan${plan.id === 'agency' ? ' featured' : ''}`} key={plan.id}>
                  <h3>{plan.name}</h3>
                  <p className="studio-price">${dollars(plan)} <span>{t('usdMonth')}</span></p>
                  <a className="studio-btn studio-btn-gold" href={plan.paymentLink} target="_blank" rel="noreferrer">{t('subscribe')}</a>
                </article>
              ))}
            </div>
            <p className="studio-lede" style={{ marginTop: '2rem' }}>
              Starter $149/mo · Growth $399/mo · Agency $999/mo · Enterprise $2499/mo. Organic on 20 networks included. Paid Meta/Google extra.
            </p>
            <p style={{ marginTop: '1.25rem' }}>
              <a className="studio-btn studio-btn-ghost" href={APPFORGE_URL} target="_blank" rel="noreferrer">{t('openAppForge')}</a>
            </p>
          </div>
        </section>
      </main>

      <footer className="studio-footer">
        <div className="wrap">
          <div>
            <div className="studio-brand" style={{ marginBottom: '0.8rem' }}>
              <img src="/marketing-logo.svg" width="28" height="28" alt="TrillionAI Marketing" />
              <span className="studio-brand-name">
                <strong>TrillionAI Marketing</strong>
                <span>Tech</span>
              </span>
            </div>
            <h2>Anselm Perkins</h2>
            <p className="role">{t('founderCeo')}</p>
          </div>
          <div>
            <div className="studio-mails">
              <a href="mailto:hello@trillionaitech.com">hello@trillionaitech.com</a>
              <a href={BRAND_URL} target="_blank" rel="noreferrer">trillionaitech.com</a>
            </div>
            <p className="fine" style={{ marginTop: '0.9rem' }}>{t('copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
