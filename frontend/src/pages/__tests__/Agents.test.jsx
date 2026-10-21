import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Agents from '../Agents'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

describe('AI Agents execution flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({
      data: [{ id: 'agent-1', agentId: 'content', name: 'Content Agent', role: 'Writes campaign content', status: 'active' }],
    })
  })

  test('runs a customer task through the selected AI agent and shows the real result', async () => {
    api.post.mockResolvedValue({
      data: { success: true, agentId: 'content', task: 'Write launch copy', result: 'Launch copy result', usage: { total_tokens: 120 } },
    })

    render(<MemoryRouter><Agents /></MemoryRouter>)

    expect(await screen.findByText('Content Agent')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/task for content agent/i), { target: { value: 'Write launch copy' } })
    fireEvent.click(screen.getByRole('button', { name: /run content agent/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/agents/agent-1/execute', { task: 'Write launch copy' }))
    expect(await screen.findByText('Launch copy result')).toBeTruthy()
    expect(screen.getByText(/120 tokens/i)).toBeTruthy()
  })

  test('shows a provider failure instead of pretending the task executed', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'The AI provider could not execute this agent task.' } } })

    render(<MemoryRouter><Agents /></MemoryRouter>)

    expect(await screen.findByText('Content Agent')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/task for content agent/i), { target: { value: 'Write launch copy' } })
    fireEvent.click(screen.getByRole('button', { name: /run content agent/i }))

    expect(await screen.findByText('The AI provider could not execute this agent task.')).toBeTruthy()
  })
})
