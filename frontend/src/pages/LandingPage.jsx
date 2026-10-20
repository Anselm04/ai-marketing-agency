import { Link } from 'react-router-dom'
import { CATALOG } from '../config/stripeCatalog'
import { APPFORGE_URL, BRAND_URL, LIBRARY } from '../config/library'
import { Check, Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import LanguageSelector from '../components/LanguageSelector'
import './landing.css'

const featureKeys = [
  ['featAgents', 'featAgentsDesc'],
  ['featPlatforms', 'featPlatformsDesc'],
  ['featLangs', 'featLangsDesc'],
  ['featLegal', 'featLegalDesc'],
  ['featAuto', 'featAutoDesc'],
  ['featTrends', 'featTrendsDesc'],
  ['featAnalytics', 'featAnalyticsDesc'],
  ['featCrm', 'featCrmDesc'],
  ['featCreator', 'featCreatorDesc'],
]

const dollars = (item) => item.amount / 100

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()

  return (
    <div className="studio">
      <header className="studio-header">
        <div className="wrap">
          <a className="studio-brand" href={BRAND_URL} target="_blank" rel="noreferrer">
            <img src="/appforge-logo.png" width="36" height="36" alt="" />
            <span className="studio-brand-name">
              <strong>TrillionAI</strong>
              <span>Tech</span>
            </span>
          </a>
          <nav className="studio-nav" aria-label="Primary">
            <a className="hide-sm" href="#products">{t('products')}</a>
            <a className="hide-sm" href="#library">{t('library')}</a>
            <a className="hide-sm" href="#pricing">{t('pricing')}</a>
            <a className="hide-sm" href={BRAND_URL} target="_blank" rel="noreferrer">trillionaitech.com</a>
            <LanguageSelector />
            <button type="button" onClick={toggleTheme} className="studio-nav-cta" aria-label={theme === 'dark' ? t('day') : t('night')} style={{ border: '1px solid var(--gold)', background: 'transparent', cursor: 'pointer' }}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span className="hide-sm">{theme === 'dark' ? t('day') : t('night')}</span>
            </button>
            <Link to="/login">{t('signIn')}</Link>
            <Link className="studio-nav-cta" to="/register">{t('getStarted')}</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="studio-hero">
          <div className="wrap">
            <p className="studio-kicker">{t('heroKicker')}</p>
            <h1>{t('heroTitle')}<br /><em>{t('heroEm')}</em> {t('heroRest')}</h1>
            <p className="studio-lede">{t('heroLede')}</p>
            <div className="studio-actions">
              <a className="studio-btn studio-btn-gold" href={APPFORGE_URL} target="_blank" rel="noreferrer">{t('openAppForge')}</a>
              <Link className="studio-btn studio-btn-ghost" to="/register">{t('startMarketing')}</Link>
              <Link className="studio-btn studio-btn-ghost" to="/dashboard/billing">{t('plansBilling')}</Link>
            </div>
            <dl className="studio-meta">
              <div>
                <dt>{t('liveProducts')}</dt>
                <dd>AppForge · Marketing · Library</dd>
              </div>
              <div>
                <dt>{t('founderCeo')}</dt>
                <dd>Anselm Perkins</dd>
              </div>
              <div>
                <dt>{t('studio')}</dt>
                <dd>TrillionAI Tech</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="studio-section" id="products">
          <div className="wrap">
            <header className="studio-head split">
              <div>
                <p className="studio-kicker">{t('platformsKicker')}</p>
                <h2>{t('platformsTitle')}</h2>
              </div>
              <p>{t('platformsLede')}</p>
            </header>
            <div className="studio-grid-2">
              <article className="studio-card">
                <p className="studio-kicker">{t('productKicker')}</p>
                <h3>AppForge</h3>
                <p>{t('appforgeBlurb')}</p>
                <p className="note">{t('appforgeNote')}</p>
                <a className="studio-btn studio-btn-gold" href={APPFORGE_URL} target="_blank" rel="noreferrer">{t('openAppForge')}</a>
              </article>
              <article className="studio-card">
                <p className="studio-kicker">{t('productKicker')}</p>
                <h3>TrillionAI Marketing</h3>
                <p>{t('marketingBlurb')}</p>
                <p className="note">{t('marketingNote')}</p>
                <div className="studio-actions" style={{ marginTop: 'auto' }}>
                  <Link className="studio-btn studio-btn-gold" to="/register">{t('createAccount')}</Link>
                  <Link className="studio-btn studio-btn-ghost" to="/dashboard/billing">{t('plansBilling')}</Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="studio-section" id="library">
          <div className="wrap">
            <header className="studio-head split">
              <div>
                <p className="studio-kicker">{t('libraryKicker')}</p>
                <h2>{t('libraryTitle')}</h2>
              </div>
              <p>{t('libraryLede')}</p>
            </header>
            <div className="studio-library">
              {LIBRARY.map((item) => (
                <article className="studio-lib-card" key={item.name}>
                  <p className="studio-kicker">{item.kind}</p>
                  <h3>{item.name}</h3>
                  <p>{item.blurb}</p>
                  <p className="studio-price">${item.price} <span>{t('usdMonth')}</span></p>
                  <div className="studio-lib-actions">
                    <a className="studio-btn studio-btn-ghost" href={item.open} target="_blank" rel="noreferrer">{t('open')}</a>
                    <a className="studio-btn studio-btn-gold" href={item.subscribe} target="_blank" rel="noreferrer">{t('subscribe')}</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="studio-section" id="work">
          <div className="wrap">
            <header className="studio-head">
              <p className="studio-kicker">{t('capability')}</p>
              <h2>{t('whatItDoes')}</h2>
            </header>
            <div className="studio-features">
              {featureKeys.map(([title, desc]) => (
                <article className="studio-feat" key={title}>
                  <h3>{t(title)}</h3>
                  <p>{t(desc)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="studio-section" id="pricing">
          <div className="wrap">
            <header className="studio-head split">
              <div>
                <p className="studio-kicker">{t('heroKicker')}</p>
                <h2>{t('pricing')}</h2>
              </div>
              <p>Monthly Marketing Agency plans. Create an account to start secure subscription checkout.</p>
            </header>
            <p className="note" style={{ marginBottom: '1.25rem' }}>
              Create an account before checkout so your subscription is securely attached to your Marketing workspace. Advertising spend is separate from these software plans. Credit packs are not currently sold because credit consumption is not yet production-ready.
            </p>
            <div className="studio-plans">
              {CATALOG.plans.map((plan) => {
                const f = plan.features || {}
                return (
                  <article className={`studio-plan${plan.id === 'agency' ? ' featured' : ''}`} key={plan.id}>
                    <h3>{plan.name}</h3>
                    <p className="studio-price">${dollars(plan)} <span>{t('usdMonth')}</span></p>
                    <ul>
                      <li><Check size={14} color="#c4a35a" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{f.agents} AI agents</li>
                      <li><Check size={14} color="#c4a35a" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{f.campaigns} campaigns</li>
                      <li><Check size={14} color="#c4a35a" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{f.postsPerDay} posts/day</li>
                      <li><Check size={14} color="#c4a35a" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{f.teamSeats} team seats</li>
                    </ul>
                    <Link className="studio-btn studio-btn-gold" to="/register">Create account to subscribe</Link>
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="studio-footer">
        <div className="wrap">
          <div>
            <div className="studio-brand" style={{ marginBottom: '0.8rem' }}>
              <img src="/appforge-logo.png" width="28" height="28" alt="" />
              <span className="studio-brand-name">
                <strong>TrillionAI</strong>
                <span>Tech</span>
              </span>
            </div>
            <h2>Anselm Perkins</h2>
            <p className="role">{t('founderCeo')}</p>
            <p className="fine">{t('footerFine')}</p>
          </div>
          <div>
            <div className="studio-mails">
              <a href="mailto:hello@trillionaitech.com">hello@trillionaitech.com</a>
              <a href="mailto:support@trillionaitech.com">support@trillionaitech.com</a>
              <a href={BRAND_URL} target="_blank" rel="noreferrer">trillionaitech.com</a>
              <a href={APPFORGE_URL} target="_blank" rel="noreferrer">AppForge</a>
            </div>
            <p className="fine" style={{ marginTop: '0.9rem' }}>{t('copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
