import { Link } from 'react-router-dom'
import { CATALOG } from '../config/stripeCatalog'
import {
  BarChart3, Bot, Check, FileText, Mail, Megaphone, Moon,
  Search, ShieldCheck, Sparkles, Sun, Users, Video
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import LanguageSelector from '../components/LanguageSelector'
import './landing.css'

const dollars = (item) => item.amount / 100

const capabilities = [
  { icon: Sparkles, title: 'Campaign strategy', text: 'Turn a product, service, audience and goal into a structured marketing campaign with messaging, channel ideas and content.' },
  { icon: FileText, title: 'Content production', text: 'Generate ad copy, landing-page copy, blog drafts, product descriptions and reusable campaign assets.' },
  { icon: Megaphone, title: 'Social marketing', text: 'Create platform-specific social posts and prepare publishing workflows. Live posting only runs through connected, supported accounts.' },
  { icon: Video, title: 'Video campaigns', text: 'Create video concepts, scripts and reusable social-video assets from your campaign brief and selected media.' },
  { icon: Mail, title: 'Email marketing', text: 'Draft email sequences and, where sending is enabled, keep marketing sends separate from transactional account email.' },
  { icon: Search, title: 'SEO & research', text: 'Generate SEO ideas and research-backed planning. Unverified or unavailable external data is not presented as live evidence.' },
  { icon: Users, title: 'Lead CRM', text: 'Keep leads and campaign context in one workspace so marketing activity can be followed up instead of disappearing into separate tools.' },
  { icon: BarChart3, title: 'Performance visibility', text: 'Track campaign activity and connected performance data without inventing ROAS, revenue, spend or other results.' },
]

const steps = [
  ['1', 'Create your account', 'Choose a plan so your workspace, usage and subscription stay attached to the correct customer.'],
  ['2', 'Describe the business or offer', 'Tell the agency what you sell, who it is for and what outcome you want.'],
  ['3', 'Generate the marketing package', 'AI creates strategy and channel-ready assets you can review before anything public happens.'],
  ['4', 'Approve and distribute', 'Export the work or publish through supported accounts you explicitly connect. Paid advertising remains separately controlled.'],
  ['5', 'Measure and improve', 'Use real available performance evidence to improve the next version. Missing provider data stays marked unavailable.'],
]

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="studio">
      <header className="studio-header">
        <div className="wrap">
          <Link className="studio-brand" to="/" aria-label="AI Marketing Agency home">
            <img src="/appforge-logo.png" width="36" height="36" alt="" />
            <span className="studio-brand-name"><strong>TrillionAI</strong><span>AI Marketing Agency</span></span>
          </Link>
          <nav className="studio-nav" aria-label="Primary">
            <a className="hide-sm" href="#services">Services</a>
            <a className="hide-sm" href="#how-it-works">How it works</a>
            <a className="hide-sm" href="#pricing">Pricing</a>
            <LanguageSelector />
            <button type="button" onClick={toggleTheme} className="studio-nav-cta" aria-label={theme === 'dark' ? 'Use light mode' : 'Use dark mode'} style={{ border: '1px solid var(--gold)', background: 'transparent', cursor: 'pointer' }}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}<span className="hide-sm">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            <Link to="/login">Sign in</Link><Link className="studio-nav-cta" to="/register">Start</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="studio-hero"><div className="wrap">
          <p className="studio-kicker">AI MARKETING AGENCY</p>
          <h1>From business idea to<br /><em>usable marketing work</em></h1>
          <p className="studio-lede">Build campaign strategy, copy, social content, video scripts, SEO ideas, email drafts and lead follow-up from one customer workspace—without pretending unverified data is real or spending ad money without your approval.</p>
          <div className="studio-actions"><Link className="studio-btn studio-btn-gold" to="/register">Create your workspace</Link><a className="studio-btn studio-btn-ghost" href="#how-it-works">See how it works</a><a className="studio-btn studio-btn-ghost" href="#pricing">View plans</a></div>
          <dl className="studio-meta"><div><dt>Built for</dt><dd>Businesses · founders · agencies</dd></div><div><dt>Customer control</dt><dd>Review before public actions</dd></div><div><dt>Paid advertising</dt><dd>Separate budget and provider controls</dd></div></dl>
        </div></section>

        <section className="studio-section" id="services"><div className="wrap">
          <header className="studio-head split"><div><p className="studio-kicker">WHAT YOU ARE BUYING</p><h2>A working marketing workspace, not a prompt box</h2></div><p>Create and manage marketing work around your own business, products and customers. External publishing and performance depend on the provider accounts you actually connect.</p></header>
          <div className="studio-features">{capabilities.map(({ icon: Icon, title, text }) => <article className="studio-feat" key={title}><Icon size={22} style={{ color: 'var(--gold)', marginBottom: '0.75rem' }} /><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div></section>

        <section className="studio-section" id="how-it-works"><div className="wrap">
          <header className="studio-head split"><div><p className="studio-kicker">CUSTOMER JOURNEY</p><h2>Simple enough to start without marketing software expertise</h2></div><p>The system keeps money and public publishing behind explicit customer actions instead of silently launching campaigns.</p></header>
          <div className="studio-library">{steps.map(([number, title, text]) => <article className="studio-lib-card" key={number}><p className="studio-kicker">STEP {number}</p><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div></section>

        <section className="studio-section"><div className="wrap">
          <header className="studio-head"><p className="studio-kicker">BUILT-IN GUARDRAILS</p><h2>Useful automation without fake certainty</h2></header>
          <div className="studio-grid-2"><article className="studio-card"><ShieldCheck size={24} style={{ color: 'var(--cyan)' }} /><h3>Money stays controlled</h3><p>Subscription checkout is separate from advertising spend. Paid advertising uses explicit budgets and remains blocked when a safe provider path is not available.</p></article><article className="studio-card"><Bot size={24} style={{ color: 'var(--cyan)' }} /><h3>AI output is not a performance claim</h3><p>Generated strategy and creative are working material. They are not presented as guaranteed conversions, revenue, ROAS or live market evidence.</p></article></div>
        </div></section>

        <section className="studio-section" id="pricing"><div className="wrap">
          <header className="studio-head split"><div><p className="studio-kicker">PRICING</p><h2>Choose the workload your business needs</h2></div><p>Monthly software plans in USD. Advertising media spend is separate. Credit packs are not sold until their consumption model is production-ready.</p></header>
          <div className="studio-plans">{CATALOG.plans.map((plan) => { const f = plan.features || {}; return <article className={`studio-plan${plan.id === 'agency' ? ' featured' : ''}`} key={plan.id}><h3>{plan.name}</h3><p className="studio-price">${dollars(plan)} <span>USD / month</span></p><ul><li><Check size={14} color="#c4a35a" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{f.agents} AI agents</li><li><Check size={14} color="#c4a35a" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{f.campaigns} active campaigns</li><li><Check size={14} color="#c4a35a" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Up to {f.postsPerDay} published posts/day</li></ul><Link className="studio-btn studio-btn-gold" to="/register">Create account to subscribe</Link></article> })}</div>
          <p className="note" style={{ marginTop: '1.25rem' }}>Plans are currently single-user workspaces. Team collaboration is not sold until shared-workspace tenant isolation is production-ready. No plan guarantees a marketing outcome.</p>
        </div></section>

        <section className="studio-section"><div className="wrap"><div className="studio-card" style={{ textAlign: 'center', alignItems: 'center' }}><p className="studio-kicker">READY TO START?</p><h2 style={{ marginBottom: '0.5rem' }}>Build the first campaign around your real business</h2><p style={{ maxWidth: 720 }}>Create an account, choose a plan, describe the offer and start producing marketing work in one workspace.</p><div className="studio-actions" style={{ justifyContent: 'center' }}><Link className="studio-btn studio-btn-gold" to="/register">Create account</Link><Link className="studio-btn studio-btn-ghost" to="/login">Sign in</Link></div></div></div></section>
      </main>

      <footer className="studio-footer"><div className="wrap"><div><div className="studio-brand" style={{ marginBottom: '0.8rem' }}><img src="/appforge-logo.png" width="28" height="28" alt="" /><span className="studio-brand-name"><strong>TrillionAI</strong><span>AI Marketing Agency</span></span></div><p className="fine">AI-assisted marketing software. External platform availability and results are not guaranteed.</p></div><div><div className="studio-mails"><a href="mailto:hello@trillionaitech.com">hello@trillionaitech.com</a><a href="mailto:support@trillionaitech.com">support@trillionaitech.com</a><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link><Link to="/login">Customer sign in</Link><Link to="/register">Create account</Link></div><p className="fine" style={{ marginTop: '0.9rem' }}>© 2026 TrillionAI Tech</p></div></div></footer>
    </div>
  )
}
