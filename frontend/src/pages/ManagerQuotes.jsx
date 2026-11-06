import {useEffect,useState} from 'react'
import api from '../services/api'
import {ReceiptText,ShieldCheck} from 'lucide-react'
import {Link} from 'react-router-dom'

function money(minor,currency){
 if(!Number.isSafeInteger(minor))return 'Price unavailable'
 try{return new Intl.NumberFormat('en-NZ',{style:'currency',currency:currency?.toUpperCase()||'NZD'}).format(minor/100)}
 catch{return (minor/100).toFixed(2)+' '+String(currency||'nzd').toUpperCase()}
}
export default function ManagerQuotes(){
 const [briefs,setBriefs]=useState([])
 const [selectedBrief,setSelectedBrief]=useState('')
 const [options,setOptions]=useState(null)
 const [quotes,setQuotes]=useState([])
 const [selectedOffer,setSelectedOffer]=useState('')
 const [readScope,setReadScope]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const sync=async(operation,payload={})=>{const {data}=await api.post('/settings/manager-sync',{operation,payload});return data}
 useEffect(()=>{
  let live=true
  Promise.all([sync('brief.list'),sync('quote.list')]).then(([b,q])=>{
   if(!live)return
   const confirmed=(b||[]).filter(item=>item.status==='confirmed')
   setBriefs(confirmed);setQuotes(q||[]);setSelectedBrief(confirmed[0]?.id||'')
  }).catch(()=>{if(live)setError('Manager quotes are unavailable. You can continue using the Marketing platform and contact support for pricing.')}).finally(()=>{if(live)setLoading(false)})
  return()=>{live=false}
 },[])
 const run=async(operation,payload,callback)=>{
  setBusy(true);setError('');setNotice('')
  try{callback(await sync(operation,payload))}
  catch(err){setError(err.response?.data?.error||'Manager could not complete that quotation request. No payment or work was initiated.')}
  finally{setBusy(false)}
 }
 const find=()=>{
  setReadScope(false);setSelectedOffer('');setOptions(null)
  run('quote.options',{briefId:selectedBrief},data=>{
   setOptions(data)
   setSelectedOffer(data.options?.[0]?.offerId||'')
  })
 }
 const prepare=()=>{
  if(!selectedOffer||!readScope)return
  run('quote.prepare',{briefId:selectedBrief,offerId:selectedOffer},data=>{
   setQuotes(old=>old.some(q=>q.id===data.id)?old:[...old,data])
   setNotice('Your quote is ready for review. No payment has been taken and no work has started.')
  })
 }
 return <div className="max-w-4xl mx-auto space-y-5 text-gray-900 dark:text-gray-100">
  <header className="flex gap-3 items-start"><ReceiptText size={30} className="text-blue-600"/><div>
   <h1 className="text-3xl font-bold">Your Marketing Packages & Quotes</h1>
   <p className="mt-2 text-gray-600 dark:text-gray-300">Clear pricing based only on verified service packages. No unexpected advertising spend and no obligation to purchase.</p>
  </div></header>
  {error&&<p role="alert" className="border border-amber-300 rounded-lg p-3 text-amber-700 dark:text-amber-300">{error}</p>}
  {notice&&<p role="status" className="border border-green-400 rounded-lg p-3">{notice}</p>}
  <section className="p-5 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 space-y-3">
   <h2 className="text-xl font-semibold">Find a suitable service package</h2>
   {loading?<p>Checking your confirmed briefs…</p>:briefs.length===0?<p>No confirmed brief is available yet. <Link to="/dashboard/onboarding" className="underline text-blue-700 dark:text-blue-300">Complete your business requirements</Link> to continue.</p>:<>
    <label className="block text-sm">Your approved business brief
     <select value={selectedBrief} onChange={e=>{setSelectedBrief(e.target.value);setOptions(null);setReadScope(false)}} className="block w-full mt-1 p-2 border rounded-lg bg-transparent dark:border-gray-700">
      {briefs.map(item=><option key={item.id} value={item.id}>{item.business} — {item.goal}</option>)}
     </select>
    </label>
    <button type="button" disabled={busy} onClick={find} className="px-4 py-2 rounded-lg bg-blue-700 text-white disabled:opacity-50">Find approved packages</button>
   </>}
   {options&&<div className="space-y-3" aria-live="polite">
    <p className="text-sm text-gray-600 dark:text-gray-300">{options.message}</p>
    {options.options?.map(option=><label key={option.offerId} className="block border rounded-lg p-4 dark:border-gray-700 cursor-pointer">
      <div className="flex items-start gap-2">
       <input type="radio" className="mt-1" name="marketing-package" checked={selectedOffer===option.offerId} onChange={()=>{setSelectedOffer(option.offerId);setReadScope(false)}}/>
       <div className="space-y-2">
        <h3 className="font-semibold">{option.name}</h3>
        <p className="font-bold text-lg">{money(option.priceMinor,option.currency)} {option.billingMode==='subscription'?'— '+(option.billingInterval||'subscription period'):'one-time'}</p>
        <p className="text-sm">Scope: {option.scopeDisclosure}</p>
        <p className="text-sm">Tax treatment: {option.taxDisclosure}</p>
        {option.includedClaims?.length>0&&<p className="text-xs text-gray-600 dark:text-gray-300">Included: {option.includedClaims.join('; ')}</p>}
       </div>
      </div>
    </label>)}
    {selectedOffer&&<>
     <p className="text-xs text-gray-600 dark:text-gray-300">Complex projects may need a separate agreed quote. Advertising spend, additional resources and extra revisions are not included unless expressly stated in the selected scope.</p>
     <label className="flex gap-2 items-start text-sm">
      <input type="checkbox" checked={readScope} onChange={e=>setReadScope(e.target.checked)} className="mt-1"/>
      <span>I have reviewed this package's price, scope and tax disclosure. Preparing a quote does not authorise payment or campaign production.</span>
     </label>
     <button type="button" disabled={busy||!readScope} onClick={prepare} className="px-4 py-2 bg-blue-700 text-white rounded-lg disabled:opacity-50">Prepare my quote</button>
    </>}
   </div>}
  </section>
  <section className="p-5 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 space-y-3">
   <div className="flex gap-2 items-center"><ShieldCheck size={20}/><h2 className="text-xl font-semibold">Your prepared quotes</h2></div>
   {quotes.length===0?<p className="text-sm text-gray-600 dark:text-gray-300">No quotes prepared yet.</p>:quotes.slice().reverse().map(q=><article className="border rounded-lg p-3 dark:border-gray-700 space-y-2" key={q.id}>
    <h3 className="font-semibold">{q.name}</h3>
    <p className="text-sm">{money(q.priceMinor,q.currency)} · {q.taxDisclosure}</p>
    <p className="text-sm">{q.scopeDisclosure}</p>
    <p className="text-xs text-gray-500">Valid until {new Date(q.expiresAt).toLocaleDateString('en-NZ')} · Payment verified: {q.paymentVerified?'Yes':'No'}</p>
    <p className="text-xs text-gray-500">No work is authorised by preparing this quote. Checkout and subscription activation require separately verified payment.</p>
    {q.checkoutReady===false&&<p className="text-sm text-amber-700 dark:text-amber-300">{q.checkoutMessage||'Checkout is not available until your Manager billing identity has been securely verified.'}</p>}
    {q.status==='offered'&&q.checkoutReady===true&&q.purchaseUrl&&<a target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-blue-700 text-white px-4 py-2 text-sm" href={q.purchaseUrl}>Review secure checkout</a>}
   </article>)}
  </section>
 </div>
}
