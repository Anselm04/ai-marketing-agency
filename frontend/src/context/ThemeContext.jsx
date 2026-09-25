import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const ThemeContext = createContext(null)

function localTheme() {
  try {
    const saved = localStorage.getItem('theme')
    if (['light', 'dark', 'system'].includes(saved)) return saved
  } catch { /* ignore */ }
  return 'system'
}

function prefersDark() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(localTheme)
  const [systemDark, setSystemDark] = useState(prefersDark)
  const [hydrated, setHydrated] = useState(false)

  const loadAccountPreference = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setHydrated(true)
      return
    }
    try {
      const res = await api.get('/settings/preferences')
      const saved = res.data?.preferences?.theme
      if (['light', 'dark', 'system'].includes(saved)) setThemeState(saved)
    } catch {
      // Keep the device-local preference if the account cannot be reached.
    } finally {
      setHydrated(true)
    }
  }

  useEffect(() => {
    loadAccountPreference()
    const handler = (event) => {
      if (event.detail?.authenticated) {
        setHydrated(false)
        loadAccountPreference()
      } else {
        setHydrated(true)
      }
    }
    window.addEventListener('trillionai:auth-changed', handler)
    return () => window.removeEventListener('trillionai:auth-changed', handler)
  }, [])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return undefined
    const handler = (event) => setSystemDark(event.matches)
    media.addEventListener?.('change', handler)
    return () => media.removeEventListener?.('change', handler)
  }, [])

  const resolvedTheme = useMemo(
    () => theme === 'system' ? (systemDark ? 'dark' : 'light') : theme,
    [theme, systemDark],
  )

  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
      root.dataset.theme = 'night'
    } else {
      root.classList.remove('dark')
      root.dataset.theme = 'day'
    }
  }, [resolvedTheme])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem('theme', theme) } catch { /* ignore */ }
    if (!localStorage.getItem('token')) return
    api.patch('/settings/preferences', { theme }).catch(() => {})
  }, [theme, hydrated])

  const setTheme = (next) => {
    if (['light', 'dark', 'system'].includes(next)) setThemeState(next)
  }

  const toggleTheme = () => {
    setThemeState(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      isDark: resolvedTheme === 'dark',
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
