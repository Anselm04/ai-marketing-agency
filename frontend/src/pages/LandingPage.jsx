import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import LanguageSelector from '../components/LanguageSelector'
import { CATALOG } from '../config/stripeCatalog'
import {
  Bot, Megaphone, Globe, Shield, Zap, TrendingUp, BarChart3,
  Users, Sparkles, ArrowRight, Moon, Sun, Heart, ExternalLink,
  Check, Star, Crown, Building2, CreditCard
} from 'lucide-react'

const APPFORGE_URL = 'https://appforge-unfurling-moon-9058.fly.dev'
const BRAND_URL = 'https://trillionaitech.com'

const features = [
  { icon: Bot, title: '13 AI Agents', desc: 'Autonomous agents for strategy, content, video, SEO, legal, and more' },
  { icon: Megaphone, title: 'All Platforms', desc: 'Publish to 50+ platforms: social, gaming, e-commerce, app stores, ads' },
  { icon: Globe, title: '20+ Languages', desc: 'Auto-translate content for global reach and local markets' },
  { icon: Shield, title: 'Legal Compliance', desc: 'Auto-generate terms, privacy policies, and compliance docs' },
  { icon: Zap, title: 'Auto-Optimization', desc: 'A/B testing, budget allocation, and ROI optimization' },
  { icon: TrendingUp, title: 'Trend Intelligence', desc: 'Real-time trend scanning across TikTok, Twitter, Google' },
  { icon: BarChart3, title: 'Deep Analytics', desc: 'Campaign analytics, lead scoring, pipeline tracking' },
  { icon: Users, title: 'CRM & Leads', desc: 'Lead scoring, auto-qualification, and pipeline management' },
  { icon: Heart, title: 'Creator Economy', desc: 'Patreon, Ko-fi, Buy Me a Coffee, and OnlyFans' },
]

const planIcons = { starter: Zap, growth: Star, agency: Crown, enterprise: Building2 }
const dollars = (item) => item.amount / 100

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-600" size={24} />
            <span className="font-bold text-lg text-gray-900 dark:text-white">TrillionAI Tech</span>
          </div>
          <div className="flex items-center gap-4">
            <a href={BRAND_URL} target="_blank" rel="noreferrer" className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">trillionaitech.com</a>
            <LanguageSelector />
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {theme === 'dark' ? <Sun size={18} className="text-gray-400" /> : <Moon size={18} className="text-gray-400" />}
            </button>
            <Link to="/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
            <Link to="/register" className="text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Get Started</Link>
          </div>
        </div>
      </header>

      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-4">TrillionAI Tech</p>
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 dark:text-white tracking-tight">
            Two live products.<br />
            <span className="text-blue-600">Build with AppForge. Grow with Marketing.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-3xl mx-auto">
            AppForge generates real live apps, games, agents, tools, software, and websites.
            TrillionAI Marketing is this app: autonomous marketing across social, ads, and SEO.
            Create an account to subscribe and launch campaigns — we do not claim campaigns are already running.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a href={APPFORGE_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Open AppForge <ExternalLink size={18} />
            </a>
            <Link to="/register" className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Start marketing <ArrowRight size={18} />
            </Link>
            <Link to="/dashboard/billing" className="px-6 py-3 text-blue-600 font-medium hover:underline">
              Plans &amp; billing
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">The live TrillionAI Tech lineup</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            We only advertise products that exist today. There is no six-product catalog until AppForge generates apps, games, and agents that actually work.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <Bot className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-2xl text-gray-900 dark:text-white mb-2">AppForge</h3>
              <p className="text-gray-500 dark:text-gray-400 flex-1">
                Generate real, live apps, games, agents, tools, software, and websites. A product of TrillionAI Tech — see the brand at trillionaitech.com.
              </p>
              <a href={APPFORGE_URL} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Open AppForge <ExternalLink size={16} />
              </a>
            </div>
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <Megaphone className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-2xl text-gray-900 dark:text-white mb-2">TrillionAI Marketing</h3>
              <p className="text-gray-500 dark:text-gray-400 flex-1">
                This app. Autonomous marketing across social, ads, and SEO. Register, pick a plan, and launch campaigns from the dashboard when you are ready.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/register" className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Create account <ArrowRight size={16} />
                </Link>
                <Link to="/dashboard/billing" className="inline-flex items-center justify-center px-5 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-white dark:hover:bg-gray-800 transition-colors">
                  Plans &amp; billing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">What TrillionAI Marketing does</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
                <f.icon className="text-blue-600 mb-4" size={28} />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">Pricing</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            Monthly plans and one-time credit packs for TrillionAI Marketing. Checkout works even if the API is down.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CATALOG.plans.map((plan) => {
              const Icon = planIcons[plan.id] || Zap
              const f = plan.features || {}
              return (
                <div key={plan.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <Icon size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                      <div className="text-sm text-gray-500 dark:text-gray-400">${dollars(plan)}/month</div>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-4 flex-1">
                    <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Check size={16} className="text-green-500" />{f.agents} AI agents</li>
                    <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Check size={16} className="text-green-500" />{f.campaigns} campaigns</li>
                    <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Check size={16} className="text-green-500" />{f.postsPerDay} posts/day</li>
                    <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Check size={16} className="text-green-500" />{f.languages} languages</li>
                    <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Check size={16} className="text-green-500" />{f.teamSeats} team seats</li>
                    {f.apiAccess && <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Check size={16} className="text-green-500" />API access</li>}
                    {f.whiteLabel && <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Check size={16} className="text-green-500" />White label</li>}
                  </ul>
                  <a
                    href={plan.paymentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 text-center transition-colors"
                  >
                    Subscribe
                  </a>
                </div>
              )
            })}
          </div>

          <h3 className="text-xl font-semibold text-center text-gray-900 dark:text-white mt-14 mb-6">Credit packs</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {CATALOG.credits.map((pack) => (
              <div key={pack.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <CreditCard size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{pack.name}</h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400">${dollars(pack)} one-time</div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1">{pack.credits} credits for extra agents, campaigns, and posts.</p>
                <a
                  href={pack.paymentLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 text-center transition-colors"
                >
                  Buy credits
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            TrillionAI Tech — Anselm Perkins, Founder &amp; CEO.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            <a href="mailto:hello@trillionaitech.com" className="hover:text-blue-600">hello@trillionaitech.com</a>
            {' \u00b7 '}
            <a href="mailto:support@trillionaitech.com" className="hover:text-blue-600">support@trillionaitech.com</a>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            <a href={BRAND_URL} target="_blank" rel="noreferrer" className="hover:text-blue-600">trillionaitech.com</a>
            {' \u00b7 '}
            <a href={APPFORGE_URL} target="_blank" rel="noreferrer" className="hover:text-blue-600">AppForge</a>
            {' \u00b7 '}Autonomous marketing for social, ads, and SEO.
          </p>
        </div>
      </footer>
    </div>
  )
}
