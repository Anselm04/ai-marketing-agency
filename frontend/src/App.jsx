import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Agents from './pages/Agents'
import Campaigns from './pages/Campaigns'
import Analytics from './pages/Analytics'
import Legal from './pages/Legal'
import Social from './pages/Social'
import ContentStudio from './pages/ContentStudio'
import VideoStudio from './pages/VideoStudio'
import CRM from './pages/CRM'
import Billing from './pages/Billing'
import Trends from './pages/Trends'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Translation from './pages/Translation'
import LandingPage from './pages/LandingPage'
import IntegrationHub from './pages/IntegrationHub'
import ModelSelector from './pages/ModelSelector'
import Team from './pages/Team'
import ProductMarketing from './pages/ProductMarketing'
import { SkeletonCard, SkeletonMetric, SkeletonList } from './components/SkeletonCard'
import EmptyState from './components/EmptyState'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="w-full max-w-4xl space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonMetric /><SkeletonMetric /><SkeletonMetric />
        </div>
      </div>
    </div>
  )
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="agents" element={<Agents />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="products" element={<ProductMarketing />} />
        <Route path="social" element={<Social />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="legal" element={<Legal />} />
        <Route path="content" element={<ContentStudio />} />
        <Route path="video" element={<VideoStudio />} />
        <Route path="translation" element={<Translation />} />
        <Route path="crm" element={<CRM />} />
        <Route path="billing" element={<Billing />} />
        <Route path="trends" element={<Trends />} />
        <Route path="settings" element={<Settings />} />
        <Route path="team" element={<Team />} />
        <Route path="integrations" element={<IntegrationHub />} />
        <Route path="models" element={<ModelSelector />} />
        <Route path="recommendations" element={<RecommendationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
