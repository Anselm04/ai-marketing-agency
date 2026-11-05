import {afterEach,describe,expect,jest,test} from '@jest/globals'
import {createHmac} from 'node:crypto'
import {managerCustomerCommand} from '../managerCustomerBridgeService.js'

const priorUrl=process.env.MANAGER_MARKETING_INGRESS_URL
const priorSecret=process.env.MANAGER_MARKETING_BRIDGE_SECRET
afterEach(()=>{
 if(priorUrl===undefined)delete process.env.MANAGER_MARKETING_INGRESS_URL;else process.env.MANAGER_MARKETING_INGRESS_URL=priorUrl
 if(priorSecret===undefined)delete process.env.MANAGER_MARKETING_BRIDGE_SECRET;else process.env.MANAGER_MARKETING_BRIDGE_SECRET=priorSecret
})
describe('Manager growth coordination',()=>{
 test('the review command is scoped and signed like all Manager requests',async()=>{
  const secret='the-test-secret-is-more-than-thirty-two-characters'
  process.env.MANAGER_MARKETING_INGRESS_URL='https://manager.example/ingress/marketing'
  process.env.MANAGER_MARKETING_BRIDGE_SECRET=secret
  const request=jest.fn(async(url,options)=>{
   expect(url).toBe('https://manager.example/ingress/marketing')
   const sent=JSON.parse(options.body)
   expect(sent.sourceUserId).toBe('specific-marketing-customer')
   expect(sent.operation).toBe('growth.review')
   expect(sent.payload.decision).toBe('approve')
   expect(options.headers['x-trillion-signature']).toBe(createHmac('sha256',secret).update(options.headers['x-trillion-timestamp']+'.').update(options.body).digest('hex'))
   return {ok:true,json:async()=>({status:'approved_for_planning',executionTriggered:false})}
  })
  const result=await managerCustomerCommand({userId:'specific-marketing-customer',operation:'growth.review',payload:{assessmentId:'assessment-id',code:'controlled_test',decision:'approve'}},request)
  expect(result.executionTriggered).toBe(false)
  expect(request).toHaveBeenCalledTimes(1)
 })
 test('unsupported execution cannot be invoked through customer bridge',async()=>{
  process.env.MANAGER_MARKETING_INGRESS_URL='https://manager.example/ingress/marketing'
  process.env.MANAGER_MARKETING_BRIDGE_SECRET='the-test-secret-is-more-than-thirty-two-characters'
  await expect(managerCustomerCommand({userId:'specific-marketing-customer',operation:'campaign.publish',payload:{}})).rejects.toThrow('manager_command_not_allowed')
 })
})
