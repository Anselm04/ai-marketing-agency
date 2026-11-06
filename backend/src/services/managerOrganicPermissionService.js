import {managerCustomerCommand} from './managerCustomerBridgeService.js';

// Fail closed: subscription, current customer permission, every destination.
// The Marketing database is not allowed to mint or cache Manager entitlements.
export async function assertManagerOrganicPosting({userId,platformIds,requiredMode='full'},command=managerCustomerCommand){
 if(!userId||!Array.isArray(platformIds)||!platformIds.length)throw Object.assign(new Error('manager_publishing_not_authorized'),{status:403});
 const status=await command({userId,operation:'automation.status',payload:{}});
 const policy=status?.policy;
 if(status?.paidManagerAutomationVerified!==true
   ||(requiredMode==='full'&&status.effectiveMode!=='full')
   ||!['semi','full'].includes(status?.effectiveMode)
   ||!policy?.actions?.includes('schedule_approved_organic')
   ||!Array.isArray(policy.platforms)
   ||platformIds.some(id=>!policy.platforms.includes(id))){
  throw Object.assign(new Error('manager_publishing_not_authorized'),{status:403});
 }
 return {verified:true,mode:status.effectiveMode,platforms:platformIds};
}
