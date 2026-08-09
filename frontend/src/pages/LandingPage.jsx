import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import {
  Bot, Megaphone, Globe, Shield, Zap, TrendingUp, BarChart3,
  Users, CreditCard, Sparkles, Check, ArrowRight, Moon, Sun,
  Gamepad2, ShoppingCart, Smartphone, Headphones, Heart
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
  { icon: CreditCard, title: 'Subscriptions', desc: 'Stripe billing, affiliate program, and revenue tracking' },
  { icon: Gamepad2, title: 'Gaming Platforms', desc: 'Steam, Twitch, Discord, Roblox, Epic, and console stores' },
  { icon: ShoppingCart, title: 'E-commerce', desc: 'Amazon, Shopify, eBay, Etsy, Gumroad, and more' },
  { icon: Smartphone, title: 'App Stores', desc: 'App Store, Google Play, Samsung, Huawei, Amazon Appstore' },
  { icon: Headphones, title: 'Audio & Podcast', desc: 'Spotify, Apple Podcasts, SoundCloud, and Clubhouse' },
  { icon: Heart, title: 'Creator Economy', desc: 'Patreon, Ko-fi, Buy Me a Coffee, and OnlyFans' },
]

const plans = [
  { name: 'Starter', price: 0, interval: 'mo', features: ['3 AI agents', '5 campaigns', '10 posts/day', '5 languages', '1 team seat', 'Basic analytics'], cta: 'Get Started' },
  { name: 'Growth', price: 49, interval: 'mo', features: ['8 AI agents', '25 campaigns', '50 posts/day', '15 languages', '3 team seats', 'Advanced analytics', 'API access'], cta: 'Start Free Trial', popular: true },
  { name: 'Pro', price: 149, interval: 'mo', features: ['13 AI agents', 'Unlimited campaigns', '200 posts/day', '20 languages', '10 team seats', 'Priority support', 'White label', 'Custom integrations'], cta: 'Contact Sales' },
]

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-600" size={24} />
            <span className="font-bold text-lg text-gray-900 dark:text-white">AI Marketing Agency</span>
          </div>
          <div className="flex items-center gap-4">
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
            <span className="text-blue-600">AI Marketing Agency</span>
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

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">Simple Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative p-6 rounded-xl border ${plan.popular ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">${plan.price}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">/{plan.interval}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Check size={16} className="text-green-500" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`mt-6 block w-full text-center py-2 rounded-lg font-medium transition-colors ${
                    plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            AI Marketing Agency — Built by Anselm Perkins. Trillion AI Tech.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Autonomous growth engine for apps, products, and services.
          </p>
        </div>
      </footer>
    </div>
  )
}