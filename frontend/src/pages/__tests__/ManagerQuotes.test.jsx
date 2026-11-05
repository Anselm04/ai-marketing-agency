import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import ManagerQuotes from '../ManagerQuotes'
const mocks=vi.hoisted(()=>({post:vi.fn()}))
vi.mock('../../services/api',()=>({default:{post:mocks.post}}))
beforeEach(()=>{
 mocks.post.mockReset()
 mocks.post.mockImplementation(async (_path,{operation})=>({
  data:operation==='brief.list'?[{id:'b1',status:'confirmed',business:'Carving studio',goal:'More bookings'}]:
    operation==='quote.list'?[]:
    operation==='quote.options'?{briefId:'b1',message:'No approved packages match.',verifiedOptionCount:0,options:[]}:null,
 }))
})
describe('customer transparent quotes',()=>{
 it('does not invent pricing when no package is approved',async()=>{
  render(<MemoryRouter><ManagerQuotes/></MemoryRouter>)
  await screen.findByText(/Your Marketing Packages & Quotes/)
  fireEvent.click(await screen.findByRole('button',{name:/Find approved packages/i}))
  await screen.findByText('No approved packages match.')
  expect(screen.queryByRole('button',{name:/Prepare my quote/i})).toBeNull()
  expect(mocks.post.mock.calls.some(([,request])=>request.operation==='quote.prepare')).toBe(false)
 })
 it('never charges or creates work merely by viewing a package',async()=>{
  mocks.post.mockImplementation(async (_path,{operation})=>({data:operation==='brief.list'?[{id:'b1',status:'confirmed',business:'Carving studio',goal:'More bookings'}]:operation==='quote.list'?[]:operation==='quote.options'?{briefId:'b1',message:'Available package',options:[{offerId:'o1',name:'Organic plan',priceMinor:75000,currency:'nzd',taxDisclosure:'GST included in NZ price.',scopeDisclosure:'Four organic posts per month, two revision rounds.',includedClaims:['Organic posts']}]}:{}}))
  render(<MemoryRouter><ManagerQuotes/></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button',{name:/Find approved packages/i}))
  await screen.findByText(/\$750\.00/)
  expect(screen.getByRole('button',{name:/Prepare my quote/i}).disabled).toBe(true)
  expect(mocks.post.mock.calls.some(([,request])=>request.operation==='quote.prepare')).toBe(false)
 })
})
