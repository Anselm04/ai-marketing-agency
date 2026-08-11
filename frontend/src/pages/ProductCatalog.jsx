import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import LanguageSelector from '../components/LanguageSelector'
import { useEffect, useState } from 'react'
import api from '../services/api'
import {
  Sparkles, Sun, Moon, ArrowLeft, Package, Check, Zap,
  Smartphone, Bot, Gamepad2, Cpu, CreditCard, ArrowRight
} from 'lucide-react'

const categoryIcons = {
  app: Smartphone,
  agent: Bot,
  game: Gamepad2,
  software: Cpu,
  tool: Zap,
  default: Package,
}

export default function ProductCatalog() {
  const { theme, toggleTheme } = useTheme()
  const { isAuthenticated } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/products/catalog')
      .then(res => { setProducts(res.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const freeProducts = products.filter(p => !p.price || p.price === 0)
  const paidProducts = products.filter(p => p.price && p.price > 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
            <Link to="/" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1">
              <ArrowLeft size={16} /> Home
            </Link>
            {!isAuthenticated && (
              <Link to="/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-6">
              <Package className="text-blue-600" size={32} />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">Products</h1>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Browse our catalog. Some products are free. Others require a one-time purchase or subscription.
              No website subscription required — you pay only for what you choose.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-64 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Paid Products */}
              {paidProducts.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <CreditCard size={20} className="text-blue-500" />
                    Available for Purchase
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paidProducts.map(product => {
                      const Icon = categoryIcons[product.category] || categoryIcons.default
                      const isRecurring = product.billingType === 'subscription' || product.billingType === 'monthly' || product.billingType === 'annual'
                      return (
                        <div key={product.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                              <Icon size={20} className="text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{product.category || 'product'}</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1">{product.description}</p>
                          {product.features && (
                            <ul className="space-y-1.5 mb-4">
                              {product.features.map((feat, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                  <Check size={12} className="text-green-500" />{feat}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <span className="text-lg font-bold text-gray-900 dark:text-white">${product.price} {product.currency || 'NZD'}</span>
                                {isRecurring && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">/{product.billingInterval || 'month'}</span>
                                )}
                              </div>
                              {isRecurring && (
                                <span className="text-xs px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-full font-medium">
                                  Recurring
                                </span>
                              )}
                            </div>
                            {product.trialPeriod > 0 && (
                              <p className="text-xs text-green-600 dark:text-green-400 mb-3">
                                {product.trialPeriod}-day free trial included
                              </p>
                            )}
                            <Link
                              to={`/products/${product.id}`}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                              View Details <ArrowRight size={16} />
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Free Products */}
              {freeProducts.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <Zap size={20} className="text-green-500" />
                    Free Products
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {freeProducts.map(product => {
                      const Icon = categoryIcons[product.category] || categoryIcons.default
                      return (
                        <div key={product.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                              <Icon size={20} className="text-green-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{product.category || 'product'}</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1">{product.description}</p>
                          {product.features && (
                            <ul className="space-y-1.5 mb-4">
                              {product.features.map((feat, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                  <Check size={12} className="text-green-500" />{feat}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                            <div className="mb-3">
                              <span className="text-lg font-bold text-green-600 dark:text-green-400">Free</span>
                            </div>
                            <Link
                              to={`/products/${product.id}`}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                            >
                              Get Started <ArrowRight size={16} />
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {products.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-gray-500 dark:text-gray-400">Products will be added to the catalog soon. Check back later.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">The public website remains free to browse at all times.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Trillion AI Tech — Anselm Perkins, CEO & Owner of Trillion AI Tech.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            No subscription or membership fee required to browse this website.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <Link to="/legal/terms/terms-v1.0" target="_blank" className="hover:text-blue-600">Terms of Service</Link>
            <Link to="/legal/privacy/privacy-v1.0" target="_blank" className="hover:text-blue-600">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
