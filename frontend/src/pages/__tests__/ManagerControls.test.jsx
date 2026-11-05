import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import ManagerControls from '../ManagerControls'
const mocks=vi.hoisted(()=>({post:vi.fn()}))
vi.mock('../../services/api',()=>({default:{post:mocks.post}}))
beforeEach(()=>{
 mocks.post.mockReset()
 mocks.post.mockResolvedValue({data:{paidManagerAutomationVerified:false,availableModes:['manual'],effectiveMode:'manual',executionEnabled:false,policy:{platforms:[]}}})
})
describe('customer Manager controls',()=>{
 it('keeps self-service in manual mode and disables premium automation',async()=>{
  render(<MemoryRouter><ManagerControls/></MemoryRouter>)
  await screen.findByText(/Manual mode is included/)
  expect(screen.getByRole('radio',{name:/Semi-automated/i}).disabled).toBe(true)
  expect(screen.getByRole('radio',{name:/Fully automated/i}).disabled).toBe(true)
  expect(screen.getByText(/Not enabled by these settings/)).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox',{name:/I understand the difference/i}))
  fireEvent.click(screen.getByRole('button',{name:'Save my Manager preferences'}))
  await waitFor(()=>expect(mocks.post).toHaveBeenCalledWith('/settings/manager-sync',expect.objectContaining({operation:'automation.set',payload:expect.objectContaining({mode:'manual',maxSpendMinor:0})})))
 })
 it('remains manual if the Manager integration is unavailable',async()=>{
  mocks.post.mockRejectedValueOnce(new Error('Manager offline'))
  render(<MemoryRouter><ManagerControls/></MemoryRouter>)
  await screen.findByRole('alert')
  expect(screen.getByRole('button',{name:'Save my Manager preferences'}).disabled).toBe(true)
 })
})
