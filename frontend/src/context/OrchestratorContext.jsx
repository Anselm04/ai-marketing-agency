import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import api from '../services/api'

const OrchestratorContext = createContext(null)

export function OrchestratorProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [taskHistory, setTaskHistory] = useState([])
  const [performance, setPerformance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const buildProfile = useCallback(async (data) => {
    setLoading(true)
    try {
      const res = await api.post('/orchestrator/profile', data)
      setProfile(res.data.profile)
      setError(null)
      return res.data.profile
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to build profile')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/orchestrator/profile')
      setProfile(res.data.profile)
    } catch (err) {
      // Profile may not exist yet; ignore
    }
  }, [])

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await api.get('/orchestrator/suggestions')
      setSuggestions(res.data.suggestions || [])
    } catch (err) {
      setSuggestions([])
    }
  }, [])

  const fetchHistory = useCallback(async (limit = 50) => {
    try {
      const res = await api.get('/orchestrator/history', { params: { limit } })
      setTaskHistory(res.data.history || [])
    } catch (err) {
      setTaskHistory([])
    }
  }, [])

  const fetchPerformance = useCallback(async () => {
    try {
      const res = await api.get('/orchestrator/performance')
      setPerformance(res.data.metrics)
    } catch (err) {
      setPerformance(null)
    }
  }, [])

  const selectModel = useCallback(async (taskType, content, options = {}) => {
    const res = await api.post('/orchestrator/select-model', { taskType, content, options })
    return res.data.selection
  }, [])

  const selectConnectors = useCallback(async (taskType, requiredOperations = []) => {
    const res = await api.post('/orchestrator/select-connectors', { taskType, requiredOperations })
    return res.data
  }, [])

  const executeAITask = useCallback(async (taskType, messages, options = {}) => {
    const res = await api.post('/orchestrator/execute-ai', { taskType, messages, options })
    return res.data
  }, [])

  const executeCampaign = useCallback(async (taskType, content, connectorOperations = []) => {
    const res = await api.post('/orchestrator/execute-campaign', { taskType, content, connectorOperations })
    return res.data
  }, [])

  const optimize = useCallback(async () => {
    const res = await api.post('/orchestrator/optimize')
    return res.data.optimization
  }, [])

  useEffect(() => {
    fetchProfile()
    fetchSuggestions()
    fetchPerformance()
  }, [fetchProfile, fetchSuggestions, fetchPerformance])

  const value = {
    profile,
    suggestions,
    taskHistory,
    performance,
    loading,
    error,
    buildProfile,
    fetchProfile,
    fetchSuggestions,
    fetchHistory,
    fetchPerformance,
    selectModel,
    selectConnectors,
    executeAITask,
    executeCampaign,
    optimize,
  }

  return <OrchestratorContext.Provider value={value}>{children}</OrchestratorContext.Provider>
}

export function useOrchestrator() {
  const ctx = useContext(OrchestratorContext)
  if (!ctx) throw new Error('useOrchestrator must be used within OrchestratorProvider')
  return ctx
}
