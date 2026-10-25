import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import AIModels from '../AIModels'
import api from '../../services/api'
const models = [
  { id: 'model-a', name: 'Model A', providerId: 'openai', provider: 'OpenAI', quality: 0.9, speed: 0.8, cost: 0.7, available: true },
  { id: 'model-b', name: 'Model B', providerId: 'groq', provider: 'Groq', quality: 0.8, speed: 0.9, cost: 0.9, available: true },
]
beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockImplementation((path) => Promise.resolve({ data: path === '/ai-models' ? { models } : { providers: [] } }))
  api.post.mockResolvedValue({ data: { selection: { modelName: 'Model B', modelId: 'model-b' } } })
})
describe('AI model recommendation contract', () => {
  test('does not claim a model card selects or saves that model', async () => {
    render(<AIModels />)
    expect(await screen.findByText('Model A')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /select for task/i })).not.toBeInTheDocument()
    expect(screen.getByText(/recommendations are suggestions/i)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })
  test('requests an automatic content recommendation and displays the actual result', async () => {
    render(<AIModels />)
    fireEvent.click(await screen.findByRole('button', { name: /recommend for content/i }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/orchestrator/select-model', { taskType: 'content-generation', content: '' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Model B')
    expect(screen.getByRole('status')).toHaveTextContent(/does not change/i)
    expect(api.patch).not.toHaveBeenCalled()
  })
  test('shows a recommendation error without removing the catalogue', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'No model available' } } })
    render(<AIModels />)
    fireEvent.click(await screen.findByRole('button', { name: /recommend for content/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No model available')
    expect(screen.getByText('Model A')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /recommend for content/i })).not.toBeDisabled()
  })
  test('does not offer a recommendation when no models are available', async () => {
    api.get.mockImplementation((path) => Promise.resolve({ data: path === '/ai-models' ? { models: models.map((model) => ({ ...model, available: false })) } : { providers: [] } }))
    render(<AIModels />)
    expect(await screen.findByRole('button', { name: /recommend for content/i })).toBeDisabled()
    expect(api.post).not.toHaveBeenCalled()
  })
  test('prevents duplicate recommendations while a request is pending', async () => {
    let complete
    api.post.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    render(<AIModels />)
    fireEvent.click(await screen.findByRole('button', { name: /recommend for content/i }))
    expect(screen.getByRole('button', { name: /finding a recommendation/i })).toBeDisabled()
    await act(async () => { complete({ data: { selection: { modelName: 'Model A' } } }) })
    expect(screen.getByRole('status')).toHaveTextContent('Model A')
    expect(api.post).toHaveBeenCalledTimes(1)
  })
  test('does not present an invalid API response as a successful recommendation', async () => {
    api.post.mockResolvedValue({ data: {} })
    render(<AIModels />)
    fireEvent.click(await screen.findByRole('button', { name: /recommend for content/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not recommend/i)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

})
