import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Lock, ArrowRight, CheckCircle } from 'lucide-react'
import api from '../services/api'

const MIN_PASSWORD = 8

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const token = searchParams.get('token')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!token) {
      return setError('This reset link is missing or incomplete. Request a new one from the forgot-password page.')
    }
    if (password !== confirm) return setError('Those passwords do not match. Try typing them again.')
    if (password.length < MIN_PASSWORD) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters.`)
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
    } catch (err) {
      const raw = err.response?.data?.error || ''
      if (/invalid|expired/i.test(raw)) {
        setError('This reset link is invalid or has expired. Request a new one — links only work once.')
      } else {
        setError(raw || 'We could not update your password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a new password</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Use at least {MIN_PASSWORD} characters</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle className="mx-auto text-green-500" size={48} />
              <h3 className="font-semibold text-gray-900 dark:text-white">Password updated</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">You can sign in with your new password now.</p>
              <Link to="/login" className="text-sm text-blue-600 hover:underline">Sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>
              )}
              {!token && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm rounded-lg">
                  This page needs a valid reset link from your email.{' '}
                  <Link to="/forgot-password" className="underline">Request a new link</Link>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="password"
                    required
                    minLength={MIN_PASSWORD}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Must be at least {MIN_PASSWORD} characters.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="password"
                    required
                    minLength={MIN_PASSWORD}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Updating…' : 'Update password'}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
