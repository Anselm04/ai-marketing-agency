import {describe,expect,jest,test} from '@jest/globals'
import {assertManagerOrganicPosting} from '../managerOrganicPermissionService.js'

const status={paidManagerAutomationVerified:true,effectiveMode:'full',policy:{actions:['schedule_approved_organic'],platforms:['facebook','instagram']}}
describe('Manager posting permission service',()=>{
 test('requires a separately verified paid Manager subscription and full mode',async()=>{
  await expect(assertManagerOrganicPosting({userId:'a',platformIds:['facebook']},async()=>({...status,paidManagerAutomationVerified:false}))).rejects.toMatchObject({status:403})
  await expect(assertManagerOrganicPosting({userId:'a',platformIds:['facebook']},async()=>({...status,effectiveMode:'semi'}))).rejects.toMatchObject({status:403})
  await expect(assertManagerOrganicPosting({userId:'a',platformIds:['facebook']},async()=>({...status,policy:{actions:[],platforms:['facebook']}}))).rejects.toMatchObject({status:403})
 })
 test('blocks publishing to any unapproved platform or with no platforms',async()=>{
  await expect(assertManagerOrganicPosting({userId:'a',platformIds:['facebook','tiktok']},async()=>status)).rejects.toMatchObject({status:403})
  await expect(assertManagerOrganicPosting({userId:'a',platformIds:[]},async()=>status)).rejects.toMatchObject({status:403})
 })
 test('uses signed Manager status and approves only scoped organic operation',async()=>{
  const call=jest.fn(async()=>status)
  const result=await assertManagerOrganicPosting({userId:'user-1',platformIds:['facebook'],requiredMode:'full'},call)
  expect(result.verified).toBe(true)
  expect(call).toHaveBeenCalledWith({userId:'user-1',operation:'automation.status',payload:{}})
 })
})
