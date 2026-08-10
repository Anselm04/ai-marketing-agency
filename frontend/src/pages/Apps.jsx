import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import LanguageSelector from '../components/LanguageSelector'
import { Smartphone, ArrowLeft, Sparkles, Sun, Moon } from 'lucide-react'

export default function Apps() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-600" size={24} />
            <span className="font-bold text-lg text-gray-900 dark:text-white">AI Marketing Agency</span>
          </div>
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

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-6">
            <Smartphone className="text-blue-600" size={32} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">Apps</h1>
          <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Mobile and desktop applications for productivity, entertainment, and everyday life. Coming soon.
          </p>
        </div>
      </section>

      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            AI Marketing Agency — Anselm Perkins, CEO & Owner of Trillion AI Tech.
          </p>
        </div>
      </footer>
    </div>
  )
}
