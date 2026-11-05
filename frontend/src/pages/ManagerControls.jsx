import {useEffect,useState} from 'react'
import api from '../services/api'
import {Bot,ShieldCheck,LockKeyhole} from 'lucide-react'
import {Link} from 'react-router-dom'

const modes=[
 {value:'manual',title:'Manual — I remain in control',description:'Use all the Marketing self-service tools and an on-screen assistant to guide your work.'},
 {value:'semi',title:'Semi-automated — routine work with approvals',description:'Allow Manager to coordinate approved actions within the permissions you select.'},
 {value:'full',title:'Fully automated — within my agreed limits',description:'Delegate eligible routine operations while retaining your spending, publishing and account controls.'},
]
const defaultStatus={paidManagerAutomationVerified:false,availableModes:['manual'],effectiveMode:'manual',executionEnabled:false,automaticAdvertisingSpendAuthorized:false}
export default function ManagerControls(){
 const [status,setStatus]=useState(defaultStatus)
 const [mode,setMode]=useState('manual')
 const [platforms,setPlatforms]=useState([])
 const [ack,setAck]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [connected,setConnected]=useState(false)
 const [loading,setLoading]=useState(true)
 useEffect(()=>{
  let live=true
  api.post('/settings/manager-sync',{operation:'automation.status',payload:{}}).then(({data})=>{
   if(!live)return
   setStatus(data);setMode(data.effectiveMode||'manual');setPlatforms(data.policy?.platforms||[]);setConnected(true)
  }).catch(()=>{if(live)setError('Manager connection is not configured or available. Your account remains in manual mode. No premium automation is active.')}).finally(()=>{if(live)setLoading(false)})
  return ()=>{live=false}
 },[])
 const save=async()=>{
  setBusy(true);setError('');setNotice('')
  try{
   const {data}=await api.post('/settings/manager-sync',{
    operation:'automation.set',
    payload:{
     mode,actions:mode==='manual'?[]:['draft_campaigns','schedule_approved_organic','review_results','recommend_optimisations'],
     platforms:mode==='manual'?[]:platforms,
     maxSpendMinor:0,acknowledged:ack,version:'customer-automation-policy-v1',
    },
   })
   setStatus(data);setMode(data.effectiveMode||'manual');setAck(false)
   setNotice('Your preferences were confirmed by Manager. No campaign was published or executed.')
  }catch(e){setError(e.response?.data?.error||'Manager could not confirm the change. Your existing manual tools are unaffected.')}
  finally{setBusy(false)}
 }
 const togglePlatform=(item)=>{setPlatforms(old=>old.includes(item)?old.filter(x=>x!==item):[...old,item]);setAck(false)}
 return <div className="max-w-3xl mx-auto space-y-5 text-gray-900 dark:text-gray-100">
  <div className="flex gap-3 items-start">
   <Bot size={32} aria-hidden="true" className="text-blue-600"/>
   <div><h1 className="text-3xl font-bold">My TrillionAI Manager</h1><p className="text-gray-600 dark:text-gray-300 mt-2">Choose how much control you want to keep. The Marketing Assistant remains available to everyone.</p></div>
  </div>
  {error&&<p role="alert" className="p-3 border border-amber-400 rounded-lg text-amber-700 dark:text-amber-300">{error}</p>}
  {notice&&<p role="status" className="p-3 border border-green-500 rounded-lg">{notice}</p>}
  <section className="rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 p-5 space-y-4">
   <div className="flex gap-2 items-center"><ShieldCheck size={20}/><h2 className="text-lg font-semibold">Automation preferences</h2></div>
   {loading?<p>Checking your Manager permissions…</p>:<>
    {!status.paidManagerAutomationVerified&&<div className="text-sm p-3 rounded-lg bg-blue-50 dark:bg-gray-900">
      <strong>Manual mode is included.</strong> Semi and full automation require a separate verified Manager subscription and secure account linkage. A Marketing plan alone does not activate them. <Link to="/dashboard/billing" className="underline text-blue-600 dark:text-blue-300">View Marketing billing</Link>
    </div>}
    {modes.map(opt=><label key={opt.value} className={`flex gap-3 p-3 border dark:border-gray-700 rounded-lg ${status.availableModes?.includes(opt.value)&&connected?'cursor-pointer':'opacity-60'}`}>
      <input type="radio" name="manager-mode" checked={mode===opt.value} disabled={!connected||busy||!status.availableModes?.includes(opt.value)} onChange={()=>{setMode(opt.value);setAck(false)}}/>
      <span><strong>{opt.title}</strong><span className="block text-sm text-gray-600 dark:text-gray-300">{opt.description}</span></span>
    </label>)}
    {mode!=='manual'&&<fieldset className="space-y-2"><legend className="font-medium">Authorised organic platforms</legend>
      {['facebook','instagram','youtube','tiktok','linkedin','pinterest','x'].map(name=><label key={name} className="inline-flex gap-2 items-center mr-4 text-sm">
       <input type="checkbox" checked={platforms.includes(name)} onChange={()=>togglePlatform(name)}/>{name}</label>)}
    </fieldset>}
    <div className="rounded-lg border p-3 text-sm space-y-2"><div className="flex gap-2 items-center font-semibold"><LockKeyhole size={17}/> You retain control</div>
      <p>Paid advertising spending is not authorised here. Campaigns, publishing and optimisation require separate scoped permissions and verified service integrations. You can change these preferences later.</p>
      <p>Execution status: {status.executionEnabled?'Enabled under verified controls':'Not enabled by these settings'}</p>
    </div>
    <label className="flex gap-2 items-start text-sm"><input type="checkbox" className="mt-1" checked={ack} onChange={e=>setAck(e.target.checked)}/><span>I understand the difference between guidance and execution and agree to these selected permissions.</span></label>
    <button type="button" disabled={!connected||busy||!ack||(mode!=='manual'&&!platforms.length)} onClick={save} className="rounded-lg px-4 py-2 bg-blue-700 text-white disabled:opacity-50">Save my Manager preferences</button>
   </>}
  </section>
 </div>
}
