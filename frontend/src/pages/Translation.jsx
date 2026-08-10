import { useState } from 'react'
import { Globe, Languages, ArrowRight, Copy, Check } from 'lucide-react'
import api from '../services/api'

export default function Translation() {
  const [text, setText] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('Spanish')
  const [sourceLanguage, setSourceLanguage] = useState('English')
  const [result, setResult] = useState(null)
  const [multiResults, setMultiResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [languages, setLanguages] = useState([])

  const supportedLanguages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch',
    'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Turkish',
    'Polish', 'Swedish', 'Vietnamese', 'Thai', 'Indonesian', 'Greek',
  ]

  const handleTranslate = async () => {
    if (!text.trim()) return
    setLoading(true)
    setResult(null)
    setMultiResults([])
    try {
      const res = await api.post('/translation/translate', {
        content: text,
        targetLanguage,
        sourceLanguage,
      })
      setResult(res.data)
    } catch (err) {
      console.error('Translation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMultiTranslate = async () => {
    if (!text.trim() || languages.length === 0) return
    setLoading(true)
    setResult(null)
    setMultiResults([])
    try {
      const res = await api.post('/translation/translate-multiple', {
        content: text,
        languages,
      })
      setMultiResults(res.data)
    } catch (err) {
      console.error('Multi translation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyText = (txt) => {
    navigator.clipboard.writeText(txt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const toggleLanguage = (lang) => {
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="text-blue-600" size={28} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Translation Studio</h1>
          <p className="text-sm text-gray-500">Translate content into 20+ languages for global reach</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Source text</label>
            <textarea
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Paste your marketing copy, ad text, or content here..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <select
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  value={sourceLanguage}
                  onChange={e => setSourceLanguage(e.target.value)}
                >
                  {supportedLanguages.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <ArrowRight size={16} className="text-gray-400" />
                <select
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  value={targetLanguage}
                  onChange={e => setTargetLanguage(e.target.value)}
                >
                  {supportedLanguages.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <button
                onClick={handleTranslate}
                disabled={loading || !text.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Translating...' : 'Translate'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Languages size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Bulk Translation</h3>
            </div>
            <p className="text-sm text-gray-500 mb-3">Select multiple target languages and translate in one go.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {supportedLanguages.filter(l => l !== sourceLanguage).map(lang => (
                <button
                  key={lang}
                  onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    languages.includes(lang)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <button
              onClick={handleMultiTranslate}
              disabled={loading || !text.trim() || languages.length === 0}
              className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Translating...' : `Translate to ${languages.length} language${languages.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{targetLanguage} Translation</h3>
                <button
                  onClick={() => copyText(result.translated)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-800 whitespace-pre-wrap">
                {result.translated}
              </div>
              {result.fallback && (
                <p className="text-xs text-amber-600 mt-2">AI translation unavailable. Using placeholder translation.</p>
              )}
            </div>
          )}

          {multiResults.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Multi-Language Results</h3>
              <div className="space-y-3">
                {multiResults.map((r, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-blue-600">{r.language}</span>
                      <button
                        onClick={() => copyText(r.translated)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.translated}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!result && multiResults.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center h-48">
              <p className="text-sm text-gray-400">Enter text and translate to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
