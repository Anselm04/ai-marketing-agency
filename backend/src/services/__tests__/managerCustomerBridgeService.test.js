import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { createHmac } from 'node:crypto'
import { managerCustomerCommand } from '../managerCustomerBridgeService.js'

const originalUrl = process.env.MANAGER_MARKETING_INGRESS_URL
const originalSecret = process.env.MANAGER_MARKETING_BRIDGE_SECRET
const key = 'strong-secret-with-at-least-32-characters-for-bridge'
afterEach(() => {
  if(originalUrl===undefined)delete process.env.MANAGER_MARKETING_INGRESS_URL
  else process.env.MANAGER_MARKETING_INGRESS_URL=originalUrl
  if(originalSecret===undefined)delete process.env.MANAGER_MARKETING_BRIDGE_SECRET
  else process.env.MANAGER_MARKETING_BRIDGE_SECRET=originalSecret
})

describe('Marketing customer bridge',()=>{
  test('disabled when not securely configured',async()=>{
    delete process.env.MANAGER_MARKETING_INGRESS_URL
    delete process.env.MANAGER_MARKETING_BRIDGE_SECRET
    await expect(managerCustomerCommand({userId:'customer-1',operation:'brief.list',payload:{}})).rejects.toMatchObject({code:'manager_bridge_not_configured'})
  })
  test('rejects non-HTTPS and unexpected destinations',async()=>{
    process.env.MANAGER_MARKETING_BRIDGE_SECRET=key
    process.env.MANAGER_MARKETING_INGRESS_URL='http://manager.example/ingress/marketing'
    await expect(managerCustomerCommand({userId:'customer-1',operation:'brief.list',payload:{}})).rejects.toMatchObject({code:'manager_bridge_not_configured'})
    process.env.MANAGER_MARKETING_INGRESS_URL='https://manager.example/owner/tasks'
    await expect(managerCustomerCommand({userId:'customer-1',operation:'brief.list',payload:{}})).rejects.toMatchObject({code:'manager_bridge_not_configured'})
  })
  test('signs exact scoped customer request body and never sends the secret',async()=>{
    process.env.MANAGER_MARKETING_BRIDGE_SECRET=key
    process.env.MANAGER_MARKETING_INGRESS_URL='https://manager.example/ingress/marketing'
    const request=jest.fn(async (url,options)=>{
      const signature=createHmac('sha256',key).update(options.headers['x-trillion-timestamp']+'.').update(options.body).digest('hex')
      expect(signature).toBe(options.headers['x-trillion-signature'])
      expect(url).toBe('https://manager.example/ingress/marketing')
      expect(options.body).not.toContain(key)
      const body=JSON.parse(options.body)
      expect(body.sourceUserId).toBe('customer-1')
      expect(body.operation).toBe('brief.list')
      return {ok:true,json:async()=>[]}
    })
    await managerCustomerCommand({userId:'customer-1',operation:'brief.list',payload:{}},request)
    expect(request).toHaveBeenCalledTimes(1)
  })
  test('cannot invoke autonomous Manager or paid-ad operations',async()=>{
    process.env.MANAGER_MARKETING_BRIDGE_SECRET=key
    process.env.MANAGER_MARKETING_INGRESS_URL='https://manager.example/ingress/marketing'
    await expect(managerCustomerCommand({userId:'customer-1',operation:'campaign.publish',payload:{}})).rejects.toThrow('manager_command_not_allowed')
  })
})
