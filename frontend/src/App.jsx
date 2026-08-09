import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Agents from './pages/Agents'
import Campaigns from './pages/Campaigns'
import Analytics from './pages/Analytics'
import Legal from './pages/Legal'
import Social from './pages/Social'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="agents" element={<Agents />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="legal" element={<Legal />} />
        <Route path="social" element={<Social />} />
      </Route>
    </Routes>
  )
}

export default App