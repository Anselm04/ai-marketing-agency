import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import SearchBar from './SearchBar'
import { NotificationBell } from './RealtimeNotifications'
import {
  LayoutDashboard, Bot, Megaphone, BarChart3, Shield, Share2,
  FileText, Video, Users, TrendingUp, Settings,
  Lock, LogOut, ChevronDown, User, Globe, Sun, Moon, Menu, X, ShoppingCart,
  Cpu, Plug
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/dashboard/agents', icon: Bot, label: 'Agents' },
  { path: '/dashboard/campaigns', icon: Megaphone, label: 'Campaigns' },
  { path: '/dashboard/products', icon: ShoppingCart, label: 'Product Marketing' },
  { path: '/dashboard/social', icon: Share2, label: 'Social' },
  { path: '/dashboard/content', icon: FileText, label: 'Content Studio' },
  { path: '/dashboard/video', icon: Video, label: 'Video Studio' },
  { path: '/dashboard/translation', icon: Globe, label: 'Translation' },
  { path: '/dashboard/crm', icon: Users, label: 'CRM' },
  { path: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/dashboard/trends', icon: TrendingUp, label: 'Trends' },
  { path: '/dashboard/legal', icon: Shield, label: 'Legal' },
  { path: '/dashboard/ai-models', icon: Cpu, label: 'AI Models' },
  { path: '/dashboard/connectors', icon: Plug, label: 'Connectors' },
  { path: '/dashboard/settings', icon: Settings, label: 'Settings' },
  { path: '/dashboard/team', icon: Users, label: 'Team' },
  { path: '/dashboard/admin', icon: Lock, label: 'Admin', adminOnly: true },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const visibleNav = navItems.filter(item => !item.adminOnly || user?.role === 'admin')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI Marketing</h1>
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
          {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>

      {/* Sidebar - responsive */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transform transition-transform duration-200 ease-in-out lg:transform-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Trillion AI Tech</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Autonomous Growth Engine</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleNav.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.firstName || 'User'}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</div>
              </div>
              <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
            v0.1.0 Alpha — Anselm Perkins, CEO & Owner of Trillion AI Tech
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="flex-1 overflow-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          <div className="hidden lg:flex items-center justify-between mb-6 gap-4">
            <div className="flex-1 max-w-xl">
              <SearchBar />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Welcome, {user?.firstName || user?.email || 'User'}
              </div>
              <NotificationBell />
            </div>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}