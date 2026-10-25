import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import CourseFactory from '../CourseFactory'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

describe('Course Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: [] })
  })

  test('creates a rights-confirmed course project from creator intent', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        id: 'course-1',
        name: 'Learn to Carve Academy',
        kind: 'ai-course-factory',
        status: 'draft',
        approval: { humanApprovalRequired: true, status: 'pending' },
      },
    })

    render(<MemoryRouter><CourseFactory /></MemoryRouter>)

    expect(await screen.findByText('Course Factory')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/course name/i), { target: { value: 'Learn to Carve Academy' } })
    fireEvent.change(screen.getByLabelText(/target audience/i), { target: { value: 'Beginner to advanced carvers' } })
    fireEvent.change(screen.getByLabelText(/desired outcome/i), { target: { value: 'Complete a professional carving project' } })
    fireEvent.click(screen.getByLabelText(/i own this footage/i))
    fireEvent.click(screen.getByLabelText(/commercial use/i))
    fireEvent.click(screen.getByRole('button', { name: /create course project/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/course-factory/projects', expect.objectContaining({
      name: 'Learn to Carve Academy',
      rightsManifest: expect.objectContaining({ confirmedOwnership: true, commercialUseAllowed: true }),
    })))
  })

  test('shows project approval status and professional package actions', async () => {
    api.get.mockResolvedValue({
      data: [{
        id: 'course-2',
        name: 'Master Waka Huia Build',
        status: 'package_ready',
        sourceUrl: 'https://cdn.example/video.mp4',
        approval: { humanApprovalRequired: true, status: 'pending' },
        coursePackage: { modules: [{ id: 'm1', title: 'Introduction', lessons: [{ id: 'l1', title: 'Project overview' }] }] },
        exportManifest: { directSkoolPublishing: false },
      }],
    })

    render(<MemoryRouter><CourseFactory /></MemoryRouter>)

    expect(await screen.findByText('Master Waka Huia Build')).toBeTruthy()
    expect(screen.getByText(/approval pending/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /approve course/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /generate professional package/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /course bundle/i })).toBeNull()
  })

  test('shows real download controls only after creator approval', async () => {
    api.get.mockResolvedValue({
      data: [{
        id: 'course-approved',
        name: 'Approved Course',
        status: 'approved',
        sourceUrl: 'https://cdn.example/video.mp4',
        approval: { humanApprovalRequired: true, status: 'approved' },
        coursePackage: { modules: [{ id: 'm1', title: 'Foundation', lessons: [] }] },
        exportManifest: { directSkoolPublishing: false },
      }],
    })

    render(<MemoryRouter><CourseFactory /></MemoryRouter>)

    expect(await screen.findByText('Approved Course')).toBeTruthy()
    expect(screen.getByRole('button', { name: /course bundle/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /printable manual/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /skool package/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /marketing kit/i })).toBeTruthy()
  })
})
