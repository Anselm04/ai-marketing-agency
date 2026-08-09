import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from './ToastContext'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', res.data.token)
      setUser(res.data.user)
      addToast('Logged in successfully', 'success')
      return res.data
    } catch (err) {
      addToast(err.response?.data?.error || 'Login failed', 'error')
      throw err
    }
  }

  const register = async (data) => {
    try {
      const res = await api.post('/auth/register', data)
      localStorage.setItem('token', res.data.token)
      setUser(res.data.user)
      addToast('Account created successfully', 'success')
      return res.data
    } catch (err) {
      addToast(err.response?.data?.error || 'Registration failed', 'error')
      throw err
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    addToast('Logged out', 'info')
    window.location.href = '/login'
  }

  const value = { user, loading, login, register, logout, isAuthenticated: !!user }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
