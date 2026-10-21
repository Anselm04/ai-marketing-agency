import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Billing from '../Billing'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key) => key }),
}))

describe('Billing Stripe return', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let subscriptionReads = 0
    api.get.mockImplementation((path) => {
      if (path === '/billing/plans') return Promise.resolve({ data: [] })
      if (path === '/billing/catalog') return Promise.resolve({ data: { credits: [] } })
      if (path === '/billing/subscription') {
        subscriptionReads += 1
        if (subscriptionReads === 1) return Promise.resolve({ data: { status: 'none' } })
        return Promise.resolve({ data: { status: 'active', plan: 'starter', source: 'stripe' } })
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`))
    })
  })

  test('rechecks entitlement and offers business setup after Stripe webhook confirmation', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/billing?success=1&session_id=cs_test_123']}>
        <Billing />
      </MemoryRouter>,
    )

    await waitFor(() => {
      const subscriptionCalls = api.get.mock.calls.filter(([path]) => path === '/billing/subscription')
      expect(subscriptionCalls.length).toBeGreaterThanOrEqual(2)
    })

    const continueLink = await screen.findByRole('link', { name: /continue business setup/i })
    expect(continueLink.getAttribute('href')).toBe('/dashboard/onboarding')
  })
})
