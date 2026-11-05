import {beforeEach,describe,expect,jest,test} from '@jest/globals'
import express from 'express'
import request from 'supertest'
const campaigns=jest.fn(async()=>[
 {id:'c1',owner:'user-1',revenue:9000,spend:1000,performanceProvenance:{revenue:{kind:'provider_verified',provider:'meta',observedAt:'2026-10-01'},spend:{kind:'provider_verified',provider:'meta',observedAt:'2026-10-01'}}},
])
const leads=jest.fn(async()=>[{id:'lead-1',owner:'user-1'}])
const manager=jest.fn(async ({payload})=>({marketingSignals:payload.analytics}))
const store={getCampaignsByOwner:campaigns,getLeadsByOwner:leads,findUserById:jest.fn()}
jest.unstable_mockModule('../../utils/store.js',()=>({default:store}))
jest.unstable_mockModule('../../services/managerCustomerBridgeService.js',()=>({managerCustomerCommand:manager}))
jest.unstable_mockModule('../../services/accountMemoryService.js',()=>({getUserPreferences:jest.fn(),saveUserPreferences:jest.fn()}))
jest.unstable_mockModule('../../services/accountLifecycleService.js',()=>({deleteCustomerAccount:jest.fn()}))
const {default:router}=await import('../settings.js')
const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:'user-1'};next()});app.use('/settings',router)
beforeEach(()=>{manager.mockClear();campaigns.mockClear();leads.mockClear()})
describe('privacy-aware Marketing evidence for Manager',()=>{
 test('server constructs evidence metadata and drops untrusted values or raw revenue',async()=>{
  const result=await request(app).post('/settings/manager-sync').send({operation:'growth.assess',payload:{analytics:{revenue:5000000,source:'fake',campaignCount:9999}}})
  expect(result.status).toBe(200)
  const sent=manager.mock.calls[0][0]
  expect(sent.userId).toBe('user-1')
  expect(sent.payload.analytics).toEqual({
   campaignCount:1,providerVerifiedPairedCampaigns:1,providerVerifiedRevenueCampaigns:1,providerVerifiedSpendCampaigns:1,unattributedLeadCount:1,source:'marketing_server_aggregate',
  })
  expect(JSON.stringify(sent.payload)).not.toContain('9000')
  expect(JSON.stringify(sent.payload)).not.toContain('5000000')
  expect(result.body.marketingSignals.campaignCount).toBe(1)
 })
})
