import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { OrchestratorProvider } from './context/OrchestratorContext'
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
import Apps from './pages/Apps'
import AgentsPage from './pages/AgentsPage'
import Tools from './pages/Tools'
import Games from './pages/Games'
import Software from './pages/Software'
import Team from './pages/Team'
import ProductMarketing from './pages/ProductMarketing'
import AIModels from './pages/AIModels'
import Connectors from './pages/Connectors'
import { SkeletonCard, SkeletonMetric, SkeletonList } from './components/SkeletonCard'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="w-full max-w-4xl space-y-4">
        <SkeletonCard />
        <SkeletonMetric />
        <SkeletonList />
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
      <Route path="/apps" element={<Apps />} />
      <Route path="/agents" element={<AgentsPage />} />
      <Route path="/tools" element={<Tools />} />
      <Route path="/games" element={<Games />} />
      <Route path="/software" element={<Software />} />
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
        <Route path="admin" element={<Admin />} />
        <Route path="ai-models" element={<AIModels />} />
        <Route path="connectors" element={<Connectors />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <OrchestratorProvider>
              <AppRoutes />
            </OrchestratorProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
