import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../services/api'

const isDevUi = import.meta.env.DEV === true

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [emailSent, setEmailSent] = useState(null)
  const [transportOk, setTransportOk] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [devToken, setDevToken] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setDevToken(null)
    try {
      const res = await api.post('/auth/forgot-password', { email })
      setSent(true)
      setEmailSent(res.data?.emailSent ?? null)
      setTransportOk(res.data?.emailTransportConfigured ?? null)
      // Never surface reset tokens in production UI — even if a misconfigured API returns one.
      if (isDevUi && res.data?.devToken) setDevToken(res.data.devToken)
    } catch (err) {
      const msg = err.response?.data?.error
      setError(
        msg
          ? `We could not send a reset email right now. ${msg}`
          : 'We could not send a reset email right now. Please try again in a few minutes.'
      )
    } finally {
      setLoading(false)
    }
  }

  const successCopy = () => {
    if (emailSent === false && transportOk === false) {
      return 'We received your request, but email delivery is not set up on this server yet. Please contact support or try again later.'
    }
    if (emailSent === false) {
      return 'We received your request. If email is taking a moment, check spam — or try again shortly.'
    }
    return 'If an account exists for that address, we sent a reset link. Check your inbox and spam folder.'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot your password?</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter your email and we will send a reset link</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          {sent ? (
            <div className="text-center space-y-4">
              {emailSent === false && transportOk === false ? (
                <AlertCircle className="mx-auto text-amber-500" size={48} />
              ) : (
                <CheckCircle className="mx-auto text-green-500" size={48} />
              )}
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {emailSent === false && transportOk === false ? 'Request received' : 'Check your email'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{successCopy()}</p>
              {isDevUi && devToken && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-left border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">Local development only — reset link token (never shown in production):</p>
                  <Link className="text-xs font-mono break-all text-blue-600 hover:underline" to={`/reset-password?token=${encodeURIComponent(devToken)}`}>
                    Open reset page
                  </Link>
                </div>
              )}
              <Link to="/login" className="text-sm text-blue-600 hover:underline">Back to login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="email"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending…' : 'Send reset link'}
                <ArrowRight size={16} />
              </button>
              <div className="text-center text-sm text-gray-500">
                <Link to="/login" className="text-blue-600 hover:underline">Back to login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
