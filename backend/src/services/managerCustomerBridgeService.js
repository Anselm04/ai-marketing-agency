import {createHmac, createHash, randomUUID} from 'node:crypto';

// Customer data may cross from Marketing to Manager only through this authenticated
// backend-to-backend path. Never send this secret or endpoint to the browser.
function endpoint() {
  const raw=process.env.MANAGER_MARKETING_INGRESS_URL;
  const secret=process.env.MANAGER_MARKETING_BRIDGE_SECRET;
  if(!raw || !secret || secret.length<32)throw Object.assign(new Error('Manager integration is not configured.'),{code:'manager_bridge_not_configured',status:503});
  const url=new URL(raw);
  if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash
      || url.pathname!=='/ingress/marketing')throw Object.assign(new Error('Manager integration endpoint is invalid.'),{code:'manager_bridge_not_configured',status:503});
  return {url:url.href,secret};
}
export async function managerCustomerCommand({userId,operation,payload},request=fetch) {
  if(typeof userId!=='string' && typeof userId!=='number')throw Error('customer_identity_required');
  const allowed=new Set(['brief.save','brief.confirm','brief.list','growth.preferences','growth.submit','growth.state','growth.assess','growth.review','growth.erase']);
  if(!allowed.has(operation))throw Error('manager_command_not_allowed');
  const {url,secret}=endpoint();
  const sourceUserId=String(userId);
  if(!/^[a-zA-Z0-9._:-]{1,120}$/.test(sourceUserId))throw Error('invalid_customer_identity');
  const id=operation==='growth.erase'||operation==='growth.preferences' ? randomUUID() : createHash('sha256').update(JSON.stringify([sourceUserId,operation,payload||{}])).digest('hex');
  const data=JSON.stringify({sourceUserId,operation,requestId:id,payload:payload||{}});
  const timestamp=String(Date.now());
  const signature=createHmac('sha256',secret).update(timestamp+'.').update(data).digest('hex');
  const response=await request(url,{
    method:'POST',
    headers:{'content-type':'application/json','x-trillion-timestamp':timestamp,'x-trillion-signature':signature},
    body:data,
    redirect:'error',
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok){
    const error=Object.assign(new Error('Manager coordination is currently unavailable.'),{status:response.status,code:'manager_bridge_failed'});
    throw error;
  }
  return response.json();
}
