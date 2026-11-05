import {afterEach,describe,expect,jest,test} from '@jest/globals'
import {createHmac} from 'node:crypto'
import {managerCustomerCommand} from '../managerCustomerBridgeService.js'
const savedUrl=process.env.MANAGER_MARKETING_INGRESS_URL
const savedSecret=process.env.MANAGER_MARKETING_BRIDGE_SECRET
afterEach(()=>{
 if(savedUrl===undefined)delete process.env.MANAGER_MARKETING_INGRESS_URL;else process.env.MANAGER_MARKETING_INGRESS_URL=savedUrl
 if(savedSecret===undefined)delete process.env.MANAGER_MARKETING_BRIDGE_SECRET;else process.env.MANAGER_MARKETING_BRIDGE_SECRET=savedSecret
})
describe('customer campaign proposal bridge',()=>{
 test('only approved plan-review operations are signed and do not grant execution',async()=>{
  const secret='test-manager-campaign-bridge-secret-more-than-32-characters'
  process.env.MANAGER_MARKETING_BRIDGE_SECRET=secret
  process.env.MANAGER_MARKETING_INGRESS_URL='https://manager.example/ingress/marketing'
  const fetcher=jest.fn(async(_url,options)=>{
   const signature=createHmac('sha256',secret).update(options.headers['x-trillion-timestamp']+'.').update(options.body).digest('hex')
   expect(signature).toBe(options.headers['x-trillion-signature'])
   const message=JSON.parse(options.body)
   expect(message.sourceUserId).toBe('customer-1')
   expect(message.operation).toBe('campaign.review')
   expect(message.payload).toEqual({id:'proposal-1',decision:'approve'})
   expect(message.payload).not.toHaveProperty('spend')
   return {ok:true,json:async()=>({status:'approved_for_production',executionAuthorized:false,published:false,budgetMinor:0})}
  })
  const result=await managerCustomerCommand({userId:'customer-1',operation:'campaign.review',payload:{id:'proposal-1',decision:'approve'}},fetcher)
  expect(result.executionAuthorized).toBe(false)
  expect(result.published).toBe(false)
  expect(fetcher).toHaveBeenCalledTimes(1)
 })
 test('publishing and paid advertising commands remain forbidden',async()=>{
  process.env.MANAGER_MARKETING_BRIDGE_SECRET='test-manager-campaign-bridge-secret-more-than-32-characters'
  process.env.MANAGER_MARKETING_INGRESS_URL='https://manager.example/ingress/marketing'
  for(const op of ['campaign.publish','campaign.launch','paidAds.spend']){
   await expect(managerCustomerCommand({userId:'customer-1',operation:op,payload:{}})).rejects.toThrow('manager_command_not_allowed')
  }
 })
})
