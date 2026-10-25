import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Legal from '../Legal'
import api from '../../services/api'

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockReset()
  api.post.mockReset()
  api.get.mockResolvedValue({
    data: [{ id: 'privacy', name: 'Privacy Policy', type: 'legal', requiresLegalReview: true }],
  })
})

describe('Legal drafting page', () => {
  test('requires real business and jurisdiction context before generation', async () => {
    render(<Legal />)
    expect(await screen.findByText('Privacy Policy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate draft/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Customer Ltd' } })
    fireEvent.change(screen.getByLabelText('Applicable jurisdiction'), { target: { value: 'New Zealand' } })
    expect(screen.getByRole('button', { name: /generate draft/i })).not.toBeDisabled()
  })

  test('sends customer context and renders only the actual document text', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        document: {
          id: 'legal-1',
          businessName: 'Customer Ltd',
          jurisdiction: 'New Zealand',
          document: 'Real generated draft text.',
          reviewStatus: 'pending_legal_review',
          generatedAt: '2026-10-26T00:00:00.000Z',
        },
      },
    })

    render(<Legal />)
    await screen.findByText('Privacy Policy')
    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Customer Ltd' } })
    fireEvent.change(screen.getByLabelText('Applicable jurisdiction'), { target: { value: 'New Zealand' } })
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }))

    expect(api.post).toHaveBeenCalledWith('/legal/generate', {
      type: 'privacy',
      businessName: 'Customer Ltd',
      jurisdiction: 'New Zealand',
    })
    expect(await screen.findByText('Real generated draft text.')).toBeInTheDocument()
    expect(screen.getByText(/legal review pending/i)).toBeInTheDocument()
  })

  test('shows provider failure and does not keep stale draft output', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { error: 'The legal draft could not be generated right now. Nothing was saved.' } } })

    render(<Legal />)
    await screen.findByText('Privacy Policy')
    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Customer Ltd' } })
    fireEvent.change(screen.getByLabelText('Applicable jurisdiction'), { target: { value: 'New Zealand' } })
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing was saved/i)
    expect(screen.queryByText(/generated draft — legal review pending/i)).not.toBeInTheDocument()
  })
})
