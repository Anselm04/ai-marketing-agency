import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import ContentStudio from '../ContentStudio'
import api from '../../services/api'

const saved = { id: 'content-1', title: 'Launch copy', type: 'ad_copy', platform: 'website', body: 'Your saved marketing copy.', status: 'draft' }
beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: [saved] })
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue() } })
})
const show = () => render(<MemoryRouter><ContentStudio /></MemoryRouter>)
describe('Content Studio saved library', () => {
  test('loads persisted content and links to working creation tools', async () => {
    show()
    expect(await screen.findByText('Launch copy')).toBeInTheDocument()
    expect(screen.getByText(saved.body)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/content', expect.any(Object))
    expect(screen.getByRole('link', { name: /create marketing content/i })).toHaveAttribute('href', '/dashboard/products')
    expect(screen.getByRole('link', { name: /create social posts/i })).toHaveAttribute('href', '/dashboard/social')
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })
  test('shows loading while the content request is pending', async () => {
    let complete
    api.get.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    show()
    expect(screen.getByRole('status')).toHaveTextContent(/loading saved content/i)
    await act(async () => { complete({ data: [] }) })
    expect(screen.getByText(/no saved content yet/i)).toBeInTheDocument()
  })
  test('distinguishes failure from an empty library and can retry', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [saved] })
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i)
    expect(screen.queryByText(/no saved content yet/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText(saved.body)).toBeInTheDocument()
  })
  test('copies saved text and confirms only after the clipboard succeeds', async () => {
    show()
    fireEvent.click(await screen.findByRole('button', { name: /copy text/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(saved.body))
    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument()
  })
  test('reports clipboard failure and retains the text for manual copying', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('denied'))
    show()
    fireEvent.click(await screen.findByRole('button', { name: /copy text/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/copy it manually/i)
    expect(screen.getByText(saved.body)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copied/i })).not.toBeInTheDocument()
  })
  test('renders non-text records without crashing or a broken copy action', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'media', title: 'Media item', body: { assets: [] } }] })
    show()
    expect(await screen.findByText('Media item')).toBeInTheDocument()
    expect(screen.getByText(/text preview is not available/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy text/i })).not.toBeInTheDocument()
  })
  test('malformed API results show an error instead of pretending the library is empty', async () => {
    api.get.mockResolvedValue({ data: { error: 'unexpected' } })
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i)
  })
})
