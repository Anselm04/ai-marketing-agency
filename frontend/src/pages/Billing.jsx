import { useEffect, useState } from 'react'
import { CreditCard, Check, Zap, Crown, Building2, Star } from 'lucide-react'
import api from '../services/api'

export default function Billing() {
  const [plans, setPlans] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/billing/plans').then(res => setPlans(res.data))
    api.get('/billing/subscription').then(res => setSubscription(res.data))
  }, [])

  const handleCheckout = async (plan) => {
    setLoading(true)
    try {
      const res = await api.post('/billing/checkout', { priceId: plan.id })
      if (res.data.url) window.location.href = res.data.url
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return
    await api.post('/billing/cancel')
    const res = await api.get('/billing/subscription')
    setSubscription(res.data)
  }

  const planIcons = { starter: Zap, growth: Star, pro: Crown, enterprise: Building2 }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Billing</h2>
        <p className="text-gray-500 mt-1">Manage your subscription and billing</p>
      </div>

      {subscription && subscription.status !== 'none' && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Current Subscription</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-medium text-gray-900 capitalize">{subscription.plan || 'Free'} Plan</div>
              <div className="text-sm text-gray-500">Status: <span className={`font-medium ${subscription.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>{subscription.status}</span></div>
            </div>
            {subscription.status === 'active' && (
              <button onClick={handleCancel} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Cancel Subscription</button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map(plan => {
          const Icon = planIcons[plan.id] || Zap
          const isCurrent = subscription?.plan === plan.id
          return (
            <div key={plan.id} className={`bg-white rounded-xl border p-5 flex flex-col ${isCurrent ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Icon size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  <div className="text-sm text-gray-500">${plan.price}/{plan.interval}</div>
                </div>
              </div>
              <ul className="space-y-2 mb-4 flex-1">
                <li className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} className="text-green-500" />{plan.features.agents} AI agents</li>
                <li className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} className="text-green-500" />{plan.features.campaigns} campaigns</li>
                <li className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} className="text-green-500" />{plan.features.postsPerDay} posts/day</li>
                <li className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} className="text-green-500" />{plan.features.languages} languages</li>
                <li className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} className="text-green-500" />{plan.features.teamSeats} team seats</li>
                {plan.features.apiAccess && <li className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} className="text-green-500" />API access</li>}
                {plan.features.whiteLabel && <li className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} className="text-green-500" />White label</li>}
              </ul>
              <button
                onClick={() => handleCheckout(plan)}
                disabled={loading || isCurrent}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'bg-green-50 text-green-700 cursor-default'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                }`}
              >
                {isCurrent ? 'Current Plan' : 'Subscribe'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
