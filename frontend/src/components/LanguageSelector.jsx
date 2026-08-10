import { useState } from 'react'
import { Globe, ChevronDown } from 'lucide-react'

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'mr', name: 'मराठी' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'th', name: 'ไทย' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'pl', name: 'Polski' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'sv', name: 'Svenska' },
  { code: 'da', name: 'Dansk' },
  { code: 'no', name: 'Norsk' },
  { code: 'fi', name: 'Suomi' },
  { code: 'cs', name: 'Čeština' },
  { code: 'hu', name: 'Magyar' },
  { code: 'ro', name: 'Română' },
  { code: 'bg', name: 'Български' },
  { code: 'hr', name: 'Hrvatski' },
  { code: 'sr', name: 'Српски' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'he', name: 'עברית' },
  { code: 'ur', name: 'اردو' },
  { code: 'fa', name: 'فارسی' },
  { code: 'sw', name: 'Kiswahili' },
  { code: 'am', name: 'አማርኛ' },
  { code: 'my', name: 'မြန်မာစာ' },
  { code: 'km', name: 'ខ្មែរ' },
  { code: 'lo', name: 'ລາວ' },
  { code: 'ne', name: 'नेपाली' },
  { code: 'si', name: 'සිංහල' },
  { code: 'ka', name: 'ქართული' },
  { code: 'hy', name: 'Հայերեն' },
  { code: 'az', name: 'Azərbaycan dili' },
  { code: 'kk', name: 'Қазақ тілі' },
  { code: 'uk', name: 'Українська' },
  { code: 'lv', name: 'Latviešu' },
  { code: 'lt', name: 'Lietuvių' },
  { code: 'et', name: 'Eesti' },
  { code: 'sl', name: 'Slovenščina' },
  { code: 'sk', name: 'Slovenčina' },
  { code: 'mk', name: 'Македонски' },
  { code: 'sq', name: 'Shqip' },
  { code: 'bs', name: 'Bosanski' },
  { code: 'tl', name: 'Filipino' },
  { code: 'jw', name: 'Jawa' },
  { code: 'ha', name: 'Hausa' },
  { code: 'yo', name: 'Yorùbá' },
  { code: 'ig', name: 'Igbo' },
  { code: 'zu', name: 'isiZulu' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'ca', name: 'Català' },
  { code: 'eu', name: 'Euskara' },
  { code: 'gl', name: 'Galego' },
  { code: 'is', name: 'Íslenska' },
  { code: 'ga', name: 'Gaeilge' },
  { code: 'cy', name: 'Cymraeg' },
  { code: 'mt', name: 'Malti' },
  { code: 'lb', name: 'Lëtzebuergesch' },
  { code: 'mn', name: 'Монгол хэл' },
  { code: 'uz', name: 'Oʻzbek tili' },
  { code: 'ky', name: 'Кыргызча' },
  { code: 'tg', name: 'Тоҷикӣ' },
  { code: 'tk', name: 'Türkmen dili' },
  { code: 'mg', name: 'Malagasy' },
  { code: 'so', name: 'Soomaali' },
  { code: 'rw', name: 'Kinyarwanda' },
  { code: 'sn', name: 'chiShona' },
  { code: 'xh', name: 'isiXhosa' },
  { code: 'sd', name: 'سنڌي' },
  { code: 'gu', name: 'ગુજરાતી' },
  { code: 'kn', name: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'മലയാളം' },
  { code: 'as', name: 'অসমীয়া' },
  { code: 'or', name: 'ଓଡ଼ିଆ' },
  { code: 'bho', name: 'भोजपुरी' },
  { code: 'mai', name: 'मैथिली' },
  { code: 'sa', name: 'संस्कृतम्' },
]

export default function LanguageSelector() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(() => {
    return localStorage.getItem('language') || 'en'
  })

  const handleSelect = (code) => {
    setSelected(code)
    localStorage.setItem('language', code)
    setOpen(false)
  }

  const current = languages.find(l => l.code === selected) || languages[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
        aria-label="Select language"
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{current.name}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                selected === lang.code ? 'text-blue-600 font-medium' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
