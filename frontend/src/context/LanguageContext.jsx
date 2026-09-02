import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { COPY, RTL, LANGS } from '../i18n/copy'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('language') || 'en' } catch { return 'en' }
  })

  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = RTL.has(lang) ? 'rtl' : 'ltr'
    try { localStorage.setItem('language', lang) } catch { /* ignore */ }
  }, [lang])

  const t = useMemo(() => {
    const dict = COPY[lang] || COPY.en
    return (key) => dict[key] || COPY.en[key] || key
  }, [lang])

  const setLang = (code) => setLangState(code)

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
