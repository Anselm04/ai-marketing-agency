import {beforeEach,describe,expect,jest,test} from '@jest/globals'
import express from 'express'
import request from 'supertest'

let campaigns=[]
const create=jest.fn(async input=>{const row={id:'draft-'+(campaigns.length+1),...input};campaigns.push(row);return row})
const store={getCampaignsByOwner:jest.fn(async()=>campaigns)}
const manager=jest.fn(async({operation})=>{
 if(operation==='automation.status')return {paidManagerAutomationVerified:true,effectiveMode:'semi',policy:{actions:['draft_campaigns']}}
 return [{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',status:'approved_for_production',title:'Wood crafts promotion',platforms:['facebook'],objective:'More enquiries',offer:'Carved wood items',targetAudience:'Local homeowners'}]
})
jest.unstable_mockModule('../../utils/store.js',()=>({default:store}))
jest.unstable_mockModule('../../services/campaignCreationService.js',()=>({createCampaignWithinPlan:create}))
jest.unstable_mockModule('../../services/managerCustomerBridgeService.js',()=>({managerCustomerCommand:manager}))
jest.unstable_mockModule('../../services/ecosystemLock.js',()=>({withEcosystemLock:jest.fn(async(_key,fn)=>fn())}))
jest.unstable_mockModule('../../services/analyticsProvenanceService.js',()=>({markManualPerformanceInput:jest.fn(()=>({}))}))
const {default:router}=await import('../campaigns.js')
const app=express()
app.use(express.json())
app.use((req,_res,next)=>{req.user={id:'customer-1'};next()})
app.use('/campaigns',router)
beforeEach(()=>{campaigns=[];create.mockClear();manager.mockClear();store.getCampaignsByOwner.mockClear()})

describe('paid Manager proposal into real Marketing draft',()=>{
 test('requires a valid proposal id',async()=>{
  await request(app).post('/campaigns/from-manager-proposal').send({id:'arbitrary'}).expect(400)
  expect(create).not.toHaveBeenCalled()
 })
 test('creates one quota-enforced unpublished zero-budget draft',async()=>{
  const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const first=await request(app).post('/campaigns/from-manager-proposal').send({id})
  expect(first.status).toBe(201)
  expect(first.body.campaign.owner).toBe('customer-1')
  expect(first.body.campaign.status).toBe('draft')
  expect(first.body.campaign.budget).toBe(0)
  expect(first.body.published).toBe(false)
  expect(first.body.paidAdvertisingAuthorized).toBe(false)
  const second=await request(app).post('/campaigns/from-manager-proposal').send({id})
  expect(second.status).toBe(200)
  expect(create).toHaveBeenCalledTimes(1)
 })
 test('refuses expired or missing Manager entitlement',async()=>{
  manager.mockImplementation(async({operation})=>operation==='automation.status'?{paidManagerAutomationVerified:false,effectiveMode:'manual',policy:{actions:[]}}:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',status:'approved_for_production'}])
  const result=await request(app).post('/campaigns/from-manager-proposal').send({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})
  expect(result.status).toBe(403)
  expect(create).not.toHaveBeenCalled()
 })
 test('refuses unapproved proposal even if subscription is active',async()=>{
  manager.mockImplementation(async({operation})=>operation==='automation.status'?{paidManagerAutomationVerified:true,effectiveMode:'semi',policy:{actions:['draft_campaigns']}}:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',status:'proposed'}])
  await request(app).post('/campaigns/from-manager-proposal').send({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}).expect(403)
  expect(create).not.toHaveBeenCalled()
 })
})
