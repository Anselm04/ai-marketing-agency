import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Translation from '../Translation'
import VideoStudio from '../VideoStudio'
import api from '../../services/api'
beforeEach(() => { vi.clearAllMocks(); api.post.mockReset() })
const source = 'Keep this marketing copy'
const enterTranslation = () => fireEvent.change(screen.getByPlaceholderText(/paste your marketing copy/i), { target: { value: source } })
const enterVideo = () => fireEvent.change(screen.getByPlaceholderText(/how to grow your app/i), { target: { value: 'Keep my video topic' } })
describe('visible studio failures', () => {
  test('translation quota errors offer Billing, retain input, and allow a successful retry', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 402, data: { code: 'plan_quota_exceeded', error: 'internal quota detail' } } }).mockResolvedValueOnce({ data: { translated: 'Texto traducido', language: 'Spanish' } })
    render(<Translation />); enterTranslation()
    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/usage limit/i)
    expect(screen.getByRole('link', { name: /review billing/i })).toHaveAttribute('href', '/dashboard/billing')
    expect(screen.getByPlaceholderText(/paste your marketing copy/i)).toHaveValue(source)
    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))
    expect(await screen.findByText('Texto traducido')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  test('bulk translation errors are visible and keep selected languages for retry', async () => {
    api.post.mockRejectedValue(new Error('offline'))
    render(<Translation />); enterTranslation()
    fireEvent.click(screen.getByRole('button', { name: 'Spanish' }))
    fireEvent.click(screen.getByRole('button', { name: /translate to 1 language/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/connection/i)
    expect(screen.getByRole('button', { name: /translate to 1 language/i })).not.toBeDisabled()
  })
  test('fallback translation text is not presented as a successful translation', async () => {
    api.post.mockResolvedValue({ data: { translated: '[Spanish] unchanged', language: 'Spanish', fallback: true } })
    render(<Translation />); enterTranslation()
    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i)
    expect(screen.queryByText('[Spanish] unchanged')).not.toBeInTheDocument()
  })
  test.each([{}, { status: 402, errorCode: 'plan_quota_exceeded' }])('partial bulk failure retains successful translations without displaying placeholders (%j)', async (failure) => {
    api.post.mockResolvedValue({ data: [{ language: 'Spanish', translated: 'Hola' }, { language: 'French', translated: '[French] unchanged', fallback: true, ...failure }] })
    render(<Translation />); enterTranslation()
    fireEvent.click(screen.getByRole('button', { name: 'Spanish' })); fireEvent.click(screen.getByRole('button', { name: 'French' }))
    fireEvent.click(screen.getByRole('button', { name: /translate to 2 languages/i }))
    expect(await screen.findByText('Hola')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/French/i)
    expect(screen.queryByText('[French] unchanged')).not.toBeInTheDocument()
    if (failure.status === 402) expect(screen.getByRole('link', { name: /review billing/i })).toBeInTheDocument()
  })
  test('video provider failure clears stale output and keeps input available to retry', async () => {
    api.post.mockResolvedValueOnce({ data: { content: 'Old script' } }).mockRejectedValueOnce({ response: { status: 503, data: { error: 'private OPENAI_API_KEY detail' } } })
    render(<VideoStudio />); enterVideo()
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(await screen.findByText('Old script')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i)
    expect(screen.queryByText('Old script')).not.toBeInTheDocument()
    expect(screen.queryByText(/OPENAI_API_KEY/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/how to grow your app/i)).toHaveValue('Keep my video topic')
  })
  test('video fallback output is an error, not a generated result', async () => {
    api.post.mockResolvedValue({ data: { fallback: true, content: '[AI offline: missing OPENAI_API_KEY]' } })
    render(<VideoStudio />); enterVideo()
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i)
    expect(screen.queryByText(/OPENAI_API_KEY/)).not.toBeInTheDocument()
  })
  test('video quota errors provide the Billing link without clearing the topic', async () => {
    api.post.mockRejectedValue({ response: { status: 402, data: { code: 'plan_quota_exceeded' } } })
    render(<VideoStudio />); enterVideo()
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/usage limit/i)
    expect(screen.getByRole('link', { name: /review billing/i })).toHaveAttribute('href', '/dashboard/billing')
    expect(screen.getByPlaceholderText(/how to grow your app/i)).toHaveValue('Keep my video topic')
  })
  test.each([[429, /wait a moment/i], [403, /does not have access/i]])('shows actionable HTTP %s errors without private server details', async (status, message) => {
    api.post.mockRejectedValue({ response: { status, data: { error: 'private-provider-detail' } } })
    render(<VideoStudio />); enterVideo()
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('private-provider-detail')).not.toBeInTheDocument()
  })
  test('a pending video request cannot display its response under another tab', async () => {
    let complete
    api.post.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    render(<VideoStudio />); enterVideo()
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(screen.getByRole('button', { name: 'Storyboard' })).toBeDisabled()
    await act(async () => { complete({ data: { content: 'New script' } }) })
    expect(screen.getByText('New script')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Storyboard' })).not.toBeDisabled()
  })

})
