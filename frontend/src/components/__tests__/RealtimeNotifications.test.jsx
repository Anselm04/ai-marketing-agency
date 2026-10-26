import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { NotificationBell } from '../RealtimeNotifications'

const dismissNotification = vi.fn()
const clearNotifications = vi.fn()
const notification = {
  id: 'notification-1',
  type: 'info',
  title: 'Campaign ready',
  message: 'Your campaign assets are ready for review.',
}

vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => ({
    notifications: [notification],
    clearNotifications,
    dismissNotification,
    connected: true,
  }),
}))

describe('Realtime notifications', () => {
  test('dismisses one notification without clearing the whole list', () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByText('Campaign ready')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(dismissNotification).toHaveBeenCalledWith(notification)
    expect(clearNotifications).not.toHaveBeenCalled()
  })
})
