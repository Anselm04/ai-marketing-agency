import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import SocialView from '../SocialView'
import { friendlyPublishMessage } from '../../utils/customerCopy'

const props = {
  priorityShown: [], tokenDraft: {}, oauthByPlat: {}, brief: {}, typeOptions: [],
  posts: [{ id: 'draft', status: 'queued', body: 'Pending post', scheduledAt: '2026-11-01T12:00:00Z' }, { id: 'live', status: 'published', published: true, body: 'Live post' }],
  queue: vi.fn(), publishOne: vi.fn(),
}
describe('manual social queue', () => {
  test('explains manual publishing and labels old queued posts honestly', () => {
    render(<SocialView {...props} />)
    expect(screen.getByText(/posts in this manual queue do not publish automatically/i)).toBeInTheDocument()
    expect(screen.getByText(/manual queue.*not published/i)).toBeInTheDocument()
    const queueButtons = screen.getAllByRole('button', { name: /save to manual queue/i })
    expect(queueButtons).toHaveLength(1)
    fireEvent.click(queueButtons[0])
    expect(props.queue).toHaveBeenCalledWith('draft')
    const publish = screen.getByRole('button', { name: /publish now/i })
    fireEvent.click(publish)
    expect(props.publishOne).toHaveBeenCalledWith('draft')
  })
  test('does not promise automatic publication after connecting', () => {
    expect(friendlyPublishMessage({ status: 'queued' })).toMatch(/publish now/i)
    expect(friendlyPublishMessage({ status: 'queued' })).not.toMatch(/will go live/i)
    expect(friendlyPublishMessage({ queued: true, message: 'Daily publishing limit reached.' })).toContain('Daily publishing limit reached.')
  })
})
