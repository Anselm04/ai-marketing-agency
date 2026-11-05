import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { HelpCircle, X, ArrowRight, ChevronLeft } from 'lucide-react'

// Self-service help only: suggestions never run campaigns, publish posts or spend money.
// These routes refer to existing customer-facing pages. Premium automation is not implied.
const guides = [
  { match: '/dashboard/onboarding', title: 'Set up your business', steps: [
    ['Describe your business', 'Explain what you sell in your own words. You do not need marketing terminology.'],
    ['Explain your goal', 'Tell us whether you want enquiries, bookings, sales or awareness. You can edit your answer.'],
    ['Check the summary', 'Read the summary and confirm it describes your business before generating a campaign.'],
  ] },
  { match: '/dashboard/campaigns', title: 'Understand your campaigns', steps: [
    ['Open a campaign', 'Select a saved campaign to inspect its strategy and draft content.'],
    ['Check the drafts', 'Review the target audience, wording and any generation warnings.'],
    ['Choose what happens next', 'Edit in Content Studio or visit Social to review publishing. Nothing is published just by viewing.'],
  ] },
  { match: '/dashboard/paid-ads', title: 'Understand paid advertising', steps: [
    ['Connect an authorised account', 'Only connect an advertising account you are permitted to use.'],
    ['Review the costs', 'Check the service charges and advertising budget separately.'],
    ['Approve spending', 'Paid ads require your explicit authorisation. The help assistant cannot start spending.'],
  ] },
  { match: '/dashboard/analytics', title: 'Understand results', steps: [
    ['Review campaign activity', 'Views and clicks measure attention, not guaranteed sales.'],
    ['Look for enquiries and purchases', 'Check conversions when reliable tracking data is available.'],
    ['Consider real business outcomes', 'You can share growth feedback voluntarily without revealing revenue.'],
  ] },
  { match: '/dashboard/clipping', title: 'Create short clips', steps: [
    ['Choose your footage', 'Use video you own or have permission to use.'],
    ['Check the generated clips', 'Preview captions, cuts and branding before posting.'],
    ['Publish when ready', 'Use your authorised distribution account and review each destination.'],
  ] },
  { match: '/dashboard/social', title: 'Publish your content', steps: [
    ['Choose a connected account', 'Only authorised customer accounts should be used.'],
    ['Review the copy', 'Confirm the creative, destination, timing and campaign identity.'],
    ['Schedule or publish', 'Customer-directed publishing is part of self-service; autonomous management is a separate upgrade.'],
  ] },
]
const defaultGuide = { title: 'Find your way around', steps: [
  ['Tell us about your business', 'Start with Business Setup. Explain your goals in ordinary language.'],
  ['Create your first campaign', 'Visit Product Marketing to build a draft and then review it in Campaigns.'],
  ['Ask for help anytime', 'This guide explains the platform. It does not publish, spend, or control your account.'],
] }

export function getCustomerGuide(pathname) {
  return guides.find((guide) => pathname === guide.match || pathname.startsWith(guide.match + '/')) || defaultGuide
}

export default function CustomerGuide() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const guide = getCustomerGuide(pathname)

  useEffect(() => { setStep(0) }, [pathname])
  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-[calc(100vw-2rem)]">
      {open && (
        <section role="dialog" aria-label="Marketing help" className="w-[360px] max-w-full mb-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <div><p className="text-xs font-semibold text-blue-600 dark:text-blue-400">TRILLIONAI ASSISTANT</p><h2 className="font-bold">{guide.title}</h2></div>
            <button type="button" aria-label="Close help" onClick={() => setOpen(false)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
          </div>
          <div className="p-4 space-y-3" aria-live="polite">
            <p className="text-xs text-gray-500 dark:text-gray-400">Guided self-service help · Step {step + 1} of {guide.steps.length}</p>
            <h3 className="font-semibold">{guide.steps[step][0]}</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">{guide.steps[step][1]}</p>
            <div className="flex justify-between gap-2 pt-2">
              <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="inline-flex items-center gap-1 text-sm px-3 py-2 border rounded-lg disabled:opacity-40"><ChevronLeft size={16} /> Previous</button>
              <button type="button" onClick={() => step === guide.steps.length - 1 ? setOpen(false) : setStep((s) => s + 1)} className="inline-flex items-center gap-1 text-sm px-3 py-2 bg-blue-600 text-white rounded-lg">{step === guide.steps.length - 1 ? 'Done' : 'Next'} <ArrowRight size={16} /></button>
            </div>
          </div>
          <div className="border-t dark:border-gray-700 p-3 text-xs text-gray-500 dark:text-gray-400">
            Need a different section? <Link onClick={() => setOpen(false)} to="/dashboard/onboarding" className="text-blue-600 dark:text-blue-400 underline">Business setup</Link> · <Link onClick={() => setOpen(false)} to="/dashboard/campaigns" className="text-blue-600 dark:text-blue-400 underline">Campaigns</Link>
            <p className="mt-2">This guide is informational; it does not make changes or represent a paid autonomous Manager.</p>
          </div>
        </section>
      )}
      <button type="button" aria-expanded={open} aria-label={open ? 'Hide marketing help' : 'Open marketing help'} onClick={() => setOpen((o) => !o)} className="ml-auto flex items-center gap-2 rounded-full bg-blue-700 hover:bg-blue-800 text-white shadow-lg px-4 py-3 font-medium text-sm">
        <HelpCircle size={20} /> {open ? 'Hide help' : 'Need help?'}
      </button>
    </div>
  )
}
