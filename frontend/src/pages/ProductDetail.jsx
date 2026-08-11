import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import LanguageSelector from '../components/LanguageSelector'
import { useEffect, useState } from 'react'
import api from '../services/api'
import {
  Sparkles, Sun, Moon, ArrowLeft, Package, Check, Zap,
  Smartphone, Bot, Gamepad2, Cpu, CreditCard, ArrowRight,
  ShieldCheck, AlertCircle, Lock
} from 'lucide-react'

const categoryIcons = {
  app: Smartphone,
  agent: Bot,
  game: Gamepad2,
  software: Cpu,
  tool: Zap,
  default: Package,
}

export default function ProductDetail() {
  const { id } = useParams()
  const { theme, toggleTheme } = useTheme()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [termsVersions, setTermsVersions] = useState({ terms: null, privacy: null })
  const [purchaseAgreement, setPurchaseAgreement] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/products/catalog/${id}`)
      .then(res => { setProduct(res.data); setLoading(false) })
      .catch(() => setLoading(false))
    api.get('/legal/terms-versions')
      .then(res => setTermsVersions({ terms: res.data.terms, privacy: res.data.privacy }))
      .catch(() => {})
  }, [id])

  const handleCheckout = async () => {
    setError('')
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/products/${id}` } })
      return
    }
    if (!purchaseAgreement) {
      setError('You must agree to the purchase terms before proceeding.')
      return
    }
    setCheckoutLoading(true)
    try {
      const res = await api.post('/billing/checkout', { productId: id, purchaseAgreement: true })
      if (res.data.url) window.location.href = res.data.url
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed')
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Sparkles className="text-blue-600" size={24} />
              <span className="font-bold text-lg text-gray-900 dark:text-white">Trillion AI Tech</span>
            </Link>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400">Product not found.</p>
          <Link to="/products" className="mt-4 inline-block text-blue-600 hover:underline">Back to products</Link>
        </div>
      </div>
    )
  }

  const Icon = categoryIcons[product.category] || categoryIcons.default
  const isFree = !product.price || product.price === 0
  const isRecurring = product.billingType === 'subscription' || product.billingType === 'monthly' || product.billingType === 'annual'
  const buttonText = isFree
    ? 'Get Started'
    : isRecurring
      ? `Start $${product.price} ${product.currency || 'NZD'}/${product.billingInterval || 'month'} Subscription`
      : `Purchase for $${product.price} ${product.currency || 'NZD'}`

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
            <Link to="/products" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1">
              <ArrowLeft size={16} /> Products
            </Link>
            {!isAuthenticated && (
              <Link to="/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                <Icon size={28} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{product.category || 'product'}</p>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-8">{product.description}</p>

            {product.features && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Features</h2>
                <ul className="space-y-2">
                  {product.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Check size={16} className="text-green-500" />{feat}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pricing and Billing Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-700 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard size={20} className="text-blue-500" />
                Pricing
              </h2>

              {isFree ? (
                <div className="mb-4">
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">Free</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No payment required.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${product.price} {product.currency || 'NZD'}
                    </span>
                    {isRecurring && (
                      <span className="text-lg text-gray-500 dark:text-gray-400">/{product.billingInterval || 'month'}</span>
                    )}
                  </div>

                  {/* Recurring disclosure — must be extremely clear */}
                  {isRecurring && (
                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Recurring Subscription</p>
                          <p className="text-sm text-amber-700 dark:text-amber-400">
                            Renews {product.billingInterval || 'monthly'} until cancelled.
                            You will be charged ${product.price} {product.currency || 'NZD'} every {product.billingInterval || 'month'}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {product.trialPeriod > 0 && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        {product.trialPeriod}-day free trial
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Your card will not be charged until the trial ends. You can cancel before then.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>Product:</strong> {product.name}</p>
                    <p><strong>Price:</strong> ${product.price} {product.currency || 'NZD'}</p>
                    {isRecurring && (
                      <>
                        <p><strong>Billing:</strong> Recurring {product.billingInterval || 'monthly'} subscription</p>
                        <p><strong>Renewal:</strong> Automatic until you cancel</p>
                        <p><strong>Cancellation:</strong> You can cancel at any time from your account settings</p>
                      </>
                    )}
                    <p>
                      <strong>Terms:</strong>{' '}
                      <Link to={`/legal/terms/${termsVersions.terms?.id || 'terms-v1.0'}`} target="_blank" className="text-blue-600 hover:underline">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to={`/legal/privacy/${termsVersions.privacy?.id || 'privacy-v1.0'}`} target="_blank" className="text-blue-600 hover:underline">
                        Privacy Policy
                      </Link>
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Purchase Agreement — explicit, not pre-selected */}
            {!isFree && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <input
                    id="purchaseAgreement"
                    type="checkbox"
                    checked={purchaseAgreement}
                    onChange={e => setPurchaseAgreement(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="purchaseAgreement" className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    <ShieldCheck size={14} className="inline text-blue-500 mr-1" />
                    I agree to the{' '}
                    <Link to={`/legal/terms/${termsVersions.terms?.id || 'terms-v1.0'}`} target="_blank" className="text-blue-600 font-medium hover:underline">
                      Terms of Service
                    </Link>{' '}
                    and understand that I am purchasing the selected product under the pricing, subscription and cancellation terms displayed above.
                  </label>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>
            )}

            {/* Final button — clear language about financial obligation */}
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading || (!isFree && !purchaseAgreement)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {checkoutLoading ? 'Processing...' : (
                <>
                  {isFree ? <Zap size={18} /> : <Lock size={18} />}
                  {buttonText}
                </>
              )}
            </button>

            {!isAuthenticated && !isFree && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
                You will be asked to sign in or create a free account before completing the purchase.
              </p>
            )}

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                <Lock size={12} className="inline mr-1" />
                Payments are processed securely by Stripe. Trillion AI Tech never stores your payment card details.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Trillion AI Tech — Anselm Perkins, CEO & Owner of Trillion AI Tech.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <Link to={`/legal/terms/${termsVersions.terms?.id || 'terms-v1.0'}`} target="_blank" className="hover:text-blue-600">Terms of Service</Link>
            <Link to={`/legal/privacy/${termsVersions.privacy?.id || 'privacy-v1.0'}`} target="_blank" className="hover:text-blue-600">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
