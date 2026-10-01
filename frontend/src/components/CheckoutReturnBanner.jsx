import { useEffect, useState } from 'react'
import api from '../services/api'

/**
 * Honest post-checkout banner: success query !== active until webhook confirms.
 */
export default function CheckoutReturnBanner() {
  const [banner, setBanner] = useState(null)
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const canceled = params.get('canceled')
    if (success) {
      setBanner({
        kind: 'pending',
        text: 'Thanks — Stripe checkout finished. Your plan activates when payment confirmation arrives (usually within a minute). We will not show Active until that webhook lands.',
      })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (canceled) {
      setBanner({
        kind: 'canceled',
        text: 'Checkout canceled. No charge was made. You can subscribe whenever you are ready.',
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
    const loadSub = () => api.get('/billing/subscription').then((res) => setSubscription(res.data)).catch(() => {})
    loadSub()
    if (success) {
      const t1 = setTimeout(loadSub, 2500)
      const t2 = setTimeout(loadSub, 8000)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [])

  if (!banner) return null
  return (
    <div
      className="rounded-lg p-4 text-sm"
      style={{
        background: banner.kind === 'canceled' ? 'rgba(230,181,103,0.12)' : 'rgba(125,206,160,0.12)',
        border: '1px solid var(--line)',
        color: 'var(--text)',
      }}
      role="status"
    >
      {banner.text}
      {banner.kind === 'pending' && subscription?.status === 'active' && (
        <span className="block mt-2" style={{ color: 'var(--cyan)' }}>Confirmed: your subscription is now active.</span>
      )}
      {banner.kind === 'pending' && subscription?.status !== 'active' && (
        <span className="block mt-2" style={{ color: 'var(--text-muted)' }}>
          Current status: {subscription?.status || 'not active yet'}. Refresh this page if it stays pending.
        </span>
      )}
    </div>
  )
}
