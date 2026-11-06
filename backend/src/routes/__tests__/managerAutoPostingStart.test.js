import {beforeEach,describe,expect,jest,test} from '@jest/globals'
import express from 'express'
import request from 'supertest'

let content=[]
const gate=jest.fn(async()=>({verified:true,mode:'full'}))
const proposal=jest.fn(async()=>[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',status:'approved_for_production',platforms:['facebook'],title:'Approved demo',objective:'More enquiries',offer:'Handmade furniture',targetAudience:'Manawatu customers'}])
const store={
 getContentByOwner:jest.fn(async()=>content),
 createContent:jest.fn(async input=>{const row={id:'plan-'+content.length,...input};content.push(row);return row}),
}
jest.unstable_mockModule('../../utils/store.js',()=>({default:store}))
jest.unstable_mockModule('../../services/managerOrganicPermissionService.js',()=>({assertManagerOrganicPosting:gate}))
jest.unstable_mockModule('../../services/managerCustomerBridgeService.js',()=>({managerCustomerCommand:proposal}))
jest.unstable_mockModule('../../services/ecosystemLock.js',()=>({withEcosystemLock:jest.fn(async(_key,fn)=>fn())}))
jest.unstable_mockModule('../../services/autoPostingService.js',()=>({
 CADENCE_LIMITS:{daily:12,weekly:50,monthly:120},
 default:{normalizePlan:input=>({
  ...input,enabled:input.enabled===true,cadence:'daily',postsPerPeriod:1,
  sourceAssetIds:input.sourceAssetIds||[],platformIds:input.platformIds||[],timezone:'Pacific/Auckland',
 }),nextRunAt:()=> '2026-11-07T12:00:00.000Z'},
}))
jest.unstable_mockModule('../../services/videoPlatformCatalog.js',()=>({videoPlatformCatalog:[{id:'facebook',publish:'direct_api',connectorId:'meta'}]}))
jest.unstable_mockModule('../../services/appConnector.js',()=>({getTokens:jest.fn(async()=>({accessToken:'hidden'}))}))
jest.unstable_mockModule('../../services/autoPostingAnalyticsService.js',()=>({default:{}}))
jest.unstable_mockModule('../../services/socialPerformanceSyncService.js',()=>({default:{}}))
const {default:router}=await import('../autoPosting.js')
const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:'owner-1'};next()});app.use('/auto-posting',router)
const valid={
 managerPublishingConsent:true,contentRightsConfirmed:true,acknowledgeAutomatedPublishing:true,
 campaignProposalId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 sourceAssetIds:['asset-1'],platformIds:['facebook'],cadence:'daily',postsPerPeriod:1,
}
beforeEach(()=>{
 content=[{id:'asset-1',kind:'media_asset',owner:'owner-1'}]
 gate.mockReset();gate.mockResolvedValue({verified:true,mode:'full'})
 proposal.mockReset();proposal.mockResolvedValue([{id:valid.campaignProposalId,status:'approved_for_production',platforms:['facebook'],title:'Approved demo',objective:'More enquiries',offer:'Handmade furniture',targetAudience:'Manawatu customers'}])
 store.createContent.mockClear()
})
describe('Customer-approved premium organic posting',()=>{
 test('never starts without explicit permission, rights and request ID',async()=>{
  await request(app).post('/auto-posting/manager-start').send({...valid,managerPublishingConsent:false}).set('Idempotency-Key','manager-post-request-123').expect(400)
  await request(app).post('/auto-posting/manager-start').send(valid).expect(400)
  expect(store.createContent).not.toHaveBeenCalled()
 })
 test('creates one revocable Manager plan linked to approved media and destinations',async()=>{
  const one=await request(app).post('/auto-posting/manager-start').send({...valid,startImmediately:true}).set('Idempotency-Key','manager-post-request-123')
  expect(one.status).toBe(201)
  expect(one.body.plan.owner).toBe('owner-1')
  expect(one.body.plan.requiresManagerEntitlement).toBe(true)
  expect(one.body.plan.managerProposalId).toBe(valid.campaignProposalId)
  expect(one.body.plan.campaignBrief).not.toContain('unapproved')
  expect(one.body.paidAdvertisingAuthorized).toBe(false)
  const twice=await request(app).post('/auto-posting/manager-start').send(valid).set('Idempotency-Key','manager-post-request-123')
  expect(twice.status).toBe(200)
  expect(store.createContent).toHaveBeenCalledTimes(1)
  const competing=await request(app).post('/auto-posting/manager-start').send(valid).set('Idempotency-Key','different-request-key-789')
  expect(competing.status).toBe(409)
  expect(store.createContent).toHaveBeenCalledTimes(1)
 })
 test('rejects a proposal not approved by the customer',async()=>{
  proposal.mockResolvedValueOnce([{id:valid.campaignProposalId,status:'proposed',platforms:['facebook']}])
  await request(app).post('/auto-posting/manager-start').send(valid).set('Idempotency-Key','manager-post-request-987').expect(403)
  expect(store.createContent).not.toHaveBeenCalled()
 })
 test('rejects disabled Manager entitlements before saving any schedule',async()=>{
  gate.mockRejectedValueOnce(Object.assign(new Error('manager_publishing_not_authorized'),{status:403}))
  await request(app).post('/auto-posting/manager-start').send(valid).set('Idempotency-Key','manager-post-request-678').expect(403)
  expect(store.createContent).not.toHaveBeenCalled()
 })
})
