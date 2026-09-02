import { useState } from 'react'
import { Globe, ChevronDown } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

export default function LanguageSelector() {
  const [open, setOpen] = useState(false)
  const { lang, setLang, langs, t } = useLanguage()
  const current = langs.find(l => l.code === lang) || langs[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors"
        style={{ color: 'var(--gold-bright, #e8d5a3)' }}
        aria-label={t('language')}
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{current.name}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 max-h-80 overflow-y-auto z-50 border shadow-lg"
          style={{ background: 'var(--bg-elev, #0c0e14)', borderColor: 'var(--gold, #c4a35a)' }}>
          {langs.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => { setLang(item.code); setOpen(false) }}
              className="w-full text-left px-4 py-2 text-sm transition-colors"
              style={{
                color: item.code === lang ? 'var(--gold, #c4a35a)' : 'var(--text, #efeae0)',
                fontWeight: item.code === lang ? 600 : 400,
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
