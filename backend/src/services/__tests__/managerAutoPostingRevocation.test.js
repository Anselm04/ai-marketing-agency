import {describe,expect,jest,test} from '@jest/globals'
const gate=jest.fn(async()=>{throw Object.assign(new Error('manager_publishing_not_authorized'),{status:403})})
jest.unstable_mockModule('../managerOrganicPermissionService.js',()=>({assertManagerOrganicPosting:gate}))
const {default:autoPostingService}=await import('../autoPostingService.js')

describe('Manager-managed auto publishing revocation',()=>{
 test('runPlan rechecks the Manager entitlement before generating or posting',async()=>{
  const plan={id:'plan-1',owner:'client-1',enabled:true,requiresManagerEntitlement:true,platformIds:['facebook'],sourceAssetIds:['asset-1']}
  await expect(autoPostingService.runPlan(plan)).rejects.toThrow('manager_publishing_not_authorized')
  expect(gate).toHaveBeenCalledWith({userId:'client-1',platformIds:['facebook'],requiredMode:'full'})
 })
})
