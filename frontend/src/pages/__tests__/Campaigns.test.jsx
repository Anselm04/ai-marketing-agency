import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Campaigns from '../Campaigns'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}))

describe('Campaigns review flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockImplementation((path) => {
      if (path === '/campaigns') {
        return Promise.resolve({
          data: [{ id: 'cmp-1', name: 'AI Marketing: Acme', productName: 'Acme', status: 'draft', budget: 0 }],
        })
      }
      if (path === '/products/cmp-1') {
        return Promise.resolve({
          data: {
            campaign: {
              id: 'cmp-1',
              name: 'AI Marketing: Acme',
              productName: 'Acme',
              status: 'draft',
              generationStatus: 'complete',
              budget: 0,
              targetAudience: 'Small businesses',
              platforms: ['LinkedIn'],
              strategy: { campaignName: 'Acme launch', kpis: ['Qualified leads'] },
            },
            contentItems: [{ id: 'content-1', title: 'LinkedIn Post — Acme', platform: 'LinkedIn', body: 'Draft post body' }],
          },
        })
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`))
    })
  })

  test('auto-opens a newly created campaign for review and links new campaigns to the real creator', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/campaigns?created=cmp-1']}>
        <Campaigns />
      </MemoryRouter>,
    )

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/products/cmp-1'))
    expect(await screen.findByText('Review campaign')).toBeTruthy()
    expect(screen.getByText('Draft post body')).toBeTruthy()

    const newCampaign = screen.getByRole('link', { name: /new campaign/i })
    expect(newCampaign.getAttribute('href')).toBe('/dashboard/products')
  })
})
