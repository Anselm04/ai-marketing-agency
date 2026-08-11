import { Link, useParams } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import LanguageSelector from '../components/LanguageSelector'
import { useEffect, useState } from 'react'
import api from '../services/api'
import {
  Sparkles, Sun, Moon, ArrowLeft, Shield, FileText, AlertTriangle
} from 'lucide-react'

export default function LegalPage({ type }) {
  const { id } = useParams()
  const { theme, toggleTheme } = useTheme()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/legal/terms-versions/${id}`)
      .then(res => { setDoc(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="text-blue-600" size={24} />
            <span className="font-bold text-lg text-gray-900 dark:text-white">Trillion AI Tech</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {theme === 'dark' ? <Sun size={18} className="text-gray-400" /> : <Moon size={18} className="text-gray-400" />}
            </button>
            <Link to="/" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1">
              <ArrowLeft size={16} /> Home
            </Link>
          </div>
        </div>
      </header>

      <section className="py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ) : doc ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  {type === 'privacy' ? <Shield size={24} className="text-blue-600" /> : <FileText size={24} className="text-blue-600" />}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{doc.title}</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Version {doc.version} · Effective {new Date(doc.effectiveDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {doc.content}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <AlertTriangle size={48} className="text-gray-400 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Document Not Found</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-4">The requested legal document could not be found.</p>
              <Link to="/" className="text-blue-600 hover:underline">Return to Home</Link>
            </div>
          )}

          <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                This is a placeholder legal document. The final Terms of Service, Privacy Policy, and Acceptable Use Policy must be reviewed and approved by qualified legal counsel before commercial launch.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Trillion AI Tech — Anselm Perkins, CEO & Owner of Trillion AI Tech.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <Link to="/legal/terms/terms-v1.0" className="hover:text-blue-600">Terms of Service</Link>
            <Link to="/legal/privacy/privacy-v1.0" className="hover:text-blue-600">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
