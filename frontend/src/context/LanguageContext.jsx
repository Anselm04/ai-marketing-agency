import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { COPY, RTL, LANGS } from '../i18n/copy'

const LanguageContext = createContext(null)

function localLanguage() {
  try {
    const saved = localStorage.getItem('language')
    if (LANGS.some((item) => item.code === saved)) return saved
  } catch { /* ignore */ }
  return 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(localLanguage)
  const [hydrated, setHydrated] = useState(false)

  const loadAccountPreference = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setHydrated(true)
      return
    }
    try {
      const res = await api.get('/settings/preferences')
      const saved = res.data?.preferences?.language
      if (LANGS.some((item) => item.code === saved)) setLangState(saved)
    } catch {
      // Keep the device-local language if the account cannot be reached.
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
    const root = document.documentElement
    root.lang = lang
    root.dir = RTL.has(lang) ? 'rtl' : 'ltr'
    if (!hydrated) return
    try { localStorage.setItem('language', lang) } catch { /* ignore */ }
    if (!localStorage.getItem('token')) return
    api.patch('/settings/preferences', { language: lang }).catch(() => {})
  }, [lang, hydrated])

  const t = useMemo(() => {
    const dict = COPY[lang] || COPY.en
    return (key) => dict[key] || COPY.en[key] || key
  }, [lang])

  const setLang = (code) => {
    if (LANGS.some((item) => item.code === code)) setLangState(code)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, langs: LANGS, isRtl: RTL.has(lang) }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
