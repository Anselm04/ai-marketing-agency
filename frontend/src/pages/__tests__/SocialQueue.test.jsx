import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import SocialView, { supportsDirectOrganicPublishing } from '../SocialView'
import { friendlyPublishMessage } from '../../utils/customerCopy'

const props = {
  priorityShown: [], tokenDraft: {}, oauthByPlat: {}, brief: {}, typeOptions: [],
  posts: [
    { id: 'draft', platform: 'x', platformName: 'X', status: 'queued', body: 'Pending post', scheduledAt: '2026-11-01T12:00:00Z' },
    { id: 'manual', platform: 'reddit', platformName: 'Reddit', status: 'queued', body: 'Manual Reddit draft' },
    { id: 'live', platform: 'facebook', platformName: 'Facebook', status: 'published', published: true, body: 'Live post' },
  ],
  queue: vi.fn(), publishOne: vi.fn(),
}
describe('manual social queue', () => {
  test('explains 20-format drafting without claiming 20 direct publishing adapters', () => {
    render(<SocialView {...props} />)
    expect(screen.getByText(/native draft generation for 20 network formats/i)).toBeInTheDocument()
    expect(screen.getByText(/does not imply 20 direct publishing apis/i)).toBeInTheDocument()
    expect(screen.getByText(/manual publish only/i)).toBeInTheDocument()
  })

  test('offers Publish now only where a verified direct adapter exists', () => {
    render(<SocialView {...props} />)
    expect(supportsDirectOrganicPublishing('x')).toBe(true)
    expect(supportsDirectOrganicPublishing('reddit')).toBe(false)

    const publish = screen.getByRole('button', { name: /publish now/i })
    fireEvent.click(publish)
    expect(props.publishOne).toHaveBeenCalledWith('draft')
    expect(screen.getAllByRole('button', { name: /publish now/i })).toHaveLength(1)
  })

  test('keeps manual queue actions honest', () => {
    render(<SocialView {...props} />)
    expect(screen.getByText(/posts in this manual queue do not publish automatically/i)).toBeInTheDocument()
    const queueButtons = screen.getAllByRole('button', { name: /save to manual queue/i })
    expect(queueButtons).toHaveLength(2)
    fireEvent.click(queueButtons[0])
    expect(props.queue).toHaveBeenCalledWith('draft')
  })

  test('does not promise automatic publication after connecting', () => {
    expect(friendlyPublishMessage({ status: 'queued' })).toMatch(/publish now/i)
    expect(friendlyPublishMessage({ status: 'queued' })).not.toMatch(/will go live/i)
    expect(friendlyPublishMessage({ queued: true, message: 'Daily publishing limit reached.' })).toContain('Daily publishing limit reached.')
  })
})
