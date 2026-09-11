import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import SearchBar from './SearchBar'
import LanguageSelector from './LanguageSelector'
import { NotificationBell } from './RealtimeNotifications'
import {
  LayoutDashboard, Megaphone, Settings,
  Lock, LogOut, ChevronDown, Sun, Moon, Menu, X, CreditCard
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Start campaign' },
  { path: '/dashboard/campaigns', icon: Megaphone, label: "It's running" },
  { path: '/dashboard/advanced', icon: Settings, label: 'Advanced' },
  { path: '/dashboard/billing', icon: CreditCard, label: 'Billing' },
  { path: '/dashboard/settings', icon: Settings, label: 'Settings' },
  { path: '/dashboard/admin', icon: Lock, labelKey: 'admin', label: 'Admin', ownerOnly: true },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, isOwner } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const visibleNav = navItems.filter(item => !item.ownerOnly || isOwner)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--bg-elev)', borderBottom: '1px solid var(--line)' }}>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-3 rounded-lg min-h-[48px] min-w-[48px] inline-flex items-center justify-center"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <h1 className="text-lg font-bold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>TrillionAI Marketing</h1>
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm"
          style={{ background: 'rgba(196,163,90,0.2)', color: 'var(--gold)' }}>
          {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform duration-200 ease-in-out lg:transform-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ background: 'var(--bg-elev)', borderRight: '1px solid var(--line)' }}
      >
        <div className="p-6 flex items-center gap-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <img src="/marketing-logo.svg" alt="TrillionAI Marketing" width="32" height="32" />
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--gold-bright)', fontFamily: 'Cormorant Garamond, serif' }}>TrillionAI Marketing</h1>
            <p className="text-xs mt-1 tracking-widest uppercase" style={{ color: 'var(--cyan)' }}>Campaigns · Organic · Ads</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleNav.map(({ path, icon: Icon, label, labelKey }) => {
            const active = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors min-h-[48px]"
                style={active
                  ? { background: 'rgba(196,163,90,0.15)', color: 'var(--gold-bright)' }
                  : { color: 'var(--text-muted)' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={18} />
                {labelKey ? t(labelKey) : label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="flex items-center justify-between mb-3 gap-2">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm min-h-[48px]"
              style={{ color: 'var(--text-muted)' }}
              aria-label={theme === 'dark' ? t('day') : t('night')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {theme === 'dark' ? t('day') : t('night')}
            </button>
            <LanguageSelector />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg min-h-[48px]"
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm"
                style={{ background: 'rgba(196,163,90,0.2)', color: 'var(--gold)' }}>
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{user?.firstName || 'User'}</div>
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</div>
              </div>
              <ChevronDown size={16} className="flex-shrink-0" style={{ color: 'var(--text-dim)' }} />
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg shadow-lg py-1 z-50"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 min-h-[48px]"
                >
                  <LogOut size={16} />
                  {t('signOut')}
                </button>
              </div>
            )}
          </div>
          <div className="text-xs mt-3 text-center" style={{ color: 'var(--text-dim)' }}>
            Anselm Perkins, {t('founderCeo')}
          </div>
        </div>
      </aside>

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
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t('welcome')}, {user?.firstName || user?.email || 'User'}
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
