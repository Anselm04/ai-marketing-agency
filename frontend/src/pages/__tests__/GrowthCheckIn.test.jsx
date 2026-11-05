import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import GrowthCheckIn from '../GrowthCheckIn'

const get=vi.fn()
const put=vi.fn()
const post=vi.fn()
const del=vi.fn()
vi.mock('../../services/api',()=>({default:{get,put,post,delete:del}}))

beforeEach(()=>{
  get.mockReset();put.mockReset();post.mockReset();del.mockReset()
  get.mockResolvedValue({data:{settings:{level:'none',cadence:'off'},reports:[]}})
  put.mockResolvedValue({data:{settings:{level:'summary',cadence:'monthly'}}})
  post.mockResolvedValue({data:{period:'2026-11',method:'direction',value:'up',source:'customer_self_report',verifiedRevenue:false}})
})
describe('privacy-first customer growth check-in',()=>{
  it('defaults to no sharing and does not expose a report form',async()=>{
    render(<MemoryRouter><GrowthCheckIn /></MemoryRouter>)
    await screen.findByText('Your business growth check-in')
    expect(screen.getByText(/No results shared yet/)).toBeTruthy()
    expect(screen.queryByText('Submit my check-in')).toBeNull()
    expect(screen.getByText(/without disclosing your revenue/i)).toBeTruthy()
  })
  it('requires informed acknowledgement before sharing preferences',async()=>{
    render(<MemoryRouter><GrowthCheckIn /></MemoryRouter>)
    await screen.findByText('Your business growth check-in')
    fireEvent.click(screen.getByLabelText(/Share simple progress/i))
    const save=screen.getByRole('button',{name:'Save my preferences'})
    expect(save.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(()=>expect(put).toHaveBeenCalledWith('/settings/growth/preferences',expect.objectContaining({level:'summary',cadence:'monthly',understoodLimitations:true})))
  })
})
