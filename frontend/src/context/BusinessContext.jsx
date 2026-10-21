import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { useAuth } from './AuthContext'

const BusinessContext = createContext(null)
const STORAGE_KEY = 'trillionai-marketing-business-id'

export function BusinessProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [businesses, setBusinesses] = useState([])
  const [selectedBusinessId, setSelectedBusinessIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [loadingBusinesses, setLoadingBusinesses] = useState(false)

  const refreshBusinesses = useCallback(async () => {
    if (!isAuthenticated) {
      setBusinesses([])
      return []
    }
    setLoadingBusinesses(true)
    try {
      const response = await api.get('/settings/businesses')
      const rows = Array.isArray(response.data) ? response.data : []
      setBusinesses(rows)
      if (selectedBusinessId && !rows.some((row) => row.id === selectedBusinessId)) {
        setSelectedBusinessIdState('')
        localStorage.removeItem(STORAGE_KEY)
      }
      return rows
    } finally {
      setLoadingBusinesses(false)
    }
  }, [isAuthenticated, selectedBusinessId])

  useEffect(() => {
    refreshBusinesses().catch(() => setBusinesses([]))
  }, [refreshBusinesses])

  const setSelectedBusinessId = useCallback((businessId) => {
    const value = String(businessId || '')
    setSelectedBusinessIdState(value)
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  const selectedBusiness = useMemo(
    () => businesses.find((row) => row.id === selectedBusinessId) || null,
    [businesses, selectedBusinessId],
  )

  const value = useMemo(() => ({
    businesses,
    selectedBusiness,
    selectedBusinessId,
    setSelectedBusinessId,
    refreshBusinesses,
    loadingBusinesses,
  }), [businesses, selectedBusiness, selectedBusinessId, setSelectedBusinessId, refreshBusinesses, loadingBusinesses])

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}

export function useBusiness() {
  const value = useContext(BusinessContext)
  if (!value) throw new Error('useBusiness must be used inside BusinessProvider')
  return value
}
