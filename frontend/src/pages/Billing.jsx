import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import {
  CreditCard, Check, Package, ArrowRight, X, AlertCircle,
  RefreshCw, Clock, Receipt, ShieldCheck
} from 'lucide-react'
import api from '../services/api'

export default function Billing() {
  const { user } = useAuth()
  const [purchases, setPurchases] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    api.get('/billing/purchases').then(res => {
      const all = res.data || []
      setPurchases(all)
      setSubscriptions(all.filter(p =>
        p.billingType === 'subscription' || p.billingType === 'monthly' || p.billingType === 'annual'
      ))
    }).catch(() => {})
    api.get('/billing/refunds').then(res => setRefunds(res.data || [])).catch(() => {})
  }

  const handleCancel = async (purchaseId) => {
    if (!confirm('Are you sure you want to cancel this subscription? You will retain access until the current billing period ends.')) return
    setLoading(true)
    try {
      await api.post('/billing/cancel', { purchaseId })
      setActionMsg('Subscription cancelled successfully.')
      loadData()
    } catch (err) {
      setActionMsg(err.response?.data?.error || 'Cancellation failed.')
    } finally {
      setLoading(false)
      setTimeout(() => setActionMsg(''), 5000)
    }
  }

  const handleRefund = async (purchaseId) => {
    if (!confirm('Request a refund for this purchase?')) return
    setLoading(true)
    try {
      await api.post('/billing/refund-request', { purchaseId, reason: 'Customer request' })
      setActionMsg('Refund request submitted.')
      loadData()
    } catch (err) {
      setActionMsg(err.response?.data?.error || 'Refund request failed.')
    } finally {
      setLoading(false)
      setTimeout(() => setActionMsg(''), 5000)
    }
  }

  const activeSubs = subscriptions.filter(s => s.status === 'active')
  const otherPurchases = purchases.filter(p => !activeSubs.some(s => s.id === p.id))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Billing</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your purchased products, subscriptions, and billing history.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Creating an account is free. You pay only for individual products you choose to purchase.
        </p>
      </div>

      {actionMsg && (
        <div className={`p-3 rounded-lg text-sm ${
          actionMsg.includes('failed') || actionMsg.includes('error')
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
        }`}>
          {actionMsg}
        </div>
      )}

      {/* Active Subscriptions */}
      {activeSubs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <RefreshCw size={18} className="text-blue-500" />
            Active Subscriptions
          </h3>
          <div className="space-y-4">
            {activeSubs.map(sub => (
              <div key={sub.id} className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{sub.productName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    ${sub.price} {sub.currency || 'NZD'} / {sub.billingInterval || 'month'} · Renews automatically
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">Status: active</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Purchased {new Date(sub.purchasedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCancel(sub.id)}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    <X size={12} /> Cancel
                  </button>
                  <button
                    onClick={() => handleRefund(sub.id)}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Receipt size={12} /> Refund
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Purchases */}
      {purchases.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package size={18} className="text-blue-500" />
            Purchase History
          </h3>
          <div className="space-y-3">
            {purchases.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{p.productName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {p.price === 0 || !p.price ? 'Free' : `$${p.price} ${p.currency || 'NZD'}`}
                    {' · '}{p.billingType || 'one-time'}
                    {' · '}{p.status}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(p.purchasedAt).toLocaleDateString()}
                  </div>
                </div>
                {p.status === 'active' && p.price > 0 && (
                  <button
                    onClick={() => handleRefund(p.id)}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    Request Refund
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refund Requests */}
      {refunds.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Receipt size={18} className="text-blue-500" />
            Refund Requests
          </h3>
          <div className="space-y-3">
            {refunds.map(r => (
              <div key={r.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{r.reason || 'Refund request'}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Status: {r.status}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty + Browse CTA */}
      {purchases.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Package size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Purchases Yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Your account is free. Browse the product catalog to find free and paid products.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Browse Products <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {/* Billing security notice */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="text-green-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Secure Payments</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              All payments are processed by Stripe. Trillion AI Tech never stores your payment card information.
              Payment status is verified server-side before granting product access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
