import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import LanguageSelector from '../components/LanguageSelector'
import { CATALOG } from '../config/stripeCatalog'
import {
  Bot, Megaphone, Globe, Shield, Zap, TrendingUp, BarChart3,
  Users, Sparkles, ArrowRight, Moon, Sun,
  Gamepad2, Smartphone, Heart, Cpu,
  Check, Star, Crown, Building2, CreditCard
} from 'lucide-react'

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

const categories = [
  { icon: Smartphone, title: 'Apps', desc: 'Mobile and desktop applications for productivity and entertainment', path: '/apps' },
  { icon: Bot, title: 'Agents', desc: 'Autonomous AI agents for strategy, content, video, SEO, legal, and more', path: '/agents' },
  { icon: Zap, title: 'Tools', desc: 'Utility tools and software to streamline your workflow', path: '/tools' },
  { icon: Gamepad2, title: 'Games', desc: 'Interactive games and entertainment experiences', path: '/games' },
  { icon: Cpu, title: 'Software', desc: 'Full-featured software solutions for business and personal use', path: '/software' },
]

const planIcons = { starter: Zap, growth: Star, agency: Crown, enterprise: Building2 }
const dollars = (item) => item.amount / 100

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-600" size={24} />
            <span className="font-bold text-lg text-gray-900 dark:text-white">Trillion AI Tech</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {theme === 'dark' ? <Sun size={18} className="text-gray-400" /> : <Moon size={18} className="text-gray-400" />}
            </button>
            <Link to="/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
            <Link to="/register" className="text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Get Started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 dark:text-white tracking-tight">
            The World's Most Advanced<br />
            <span className="text-blue-600">Trillion AI Tech</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-3xl mx-auto">
            Autonomous AI agents that market your apps, products, and services across every platform on Earth.
            From TikTok to Steam, from the App Store to Amazon — fully automated.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link to="/register" className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Start Free <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">Everything You Need to Market Anything</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:shadow-md transition-shadow">
                <f.icon className="text-blue-600 mb-4" size={28} />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">Explore Our Universe</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            Discover apps, agents, tools, games, and software built for the future.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {categories.map((cat) => (
              <Link
                key={cat.title}
                to={cat.path}
                className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  <cat.icon className="text-blue-600" size={24} />
                </div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">{cat.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{cat.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                  Explore <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">Pricing</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            Monthly plans and one-time credit packs. Checkout works even if the API is down.
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

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            TrillionAI Tech — Anselm Perkins, Founder &amp; CEO.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            <a href="mailto:hello@trillionaitech.com" className="hover:text-blue-600">hello@trillionaitech.com</a>
            {' · '}
            <a href="mailto:support@trillionaitech.com" className="hover:text-blue-600">support@trillionaitech.com</a>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Autonomous growth engine for apps, products, and services.
          </p>
        </div>
      </footer>
    </div>
  )
}
