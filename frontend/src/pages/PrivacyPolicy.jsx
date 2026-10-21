import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-5 py-12 space-y-8">
        <div>
          <Link to="/" className="text-sm text-blue-600 dark:text-blue-400">← AI Marketing Agency</Link>
          <h1 className="mt-4 text-3xl font-bold">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: 21 October 2026</p>
        </div>
        <section className="space-y-3"><h2 className="text-xl font-semibold">What this policy covers</h2><p>This policy describes how the TrillionAI AI Marketing Agency service handles information used to create accounts, provide marketing tools, operate integrations, process billing and support customers. It does not claim that every optional third-party integration is enabled for every customer.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">Information the service may process</h2><ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300"><li>Account information such as name, email address, authentication data and account preferences.</li><li>Business context you provide, including company details, website, audience, goals, offers and brand preferences.</li><li>Campaigns, generated content, uploaded media, CRM leads and other workspace data you choose to store.</li><li>Integration information needed to connect supported social, advertising, analytics or other providers.</li><li>Usage, operational, security and error data needed to run, protect and troubleshoot the service.</li><li>Subscription and payment references. Payment-card processing is handled by Stripe rather than by this application storing raw card details.</li></ul></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">How information is used</h2><p>Information is used to provide the requested service, save your workspace, generate marketing material, operate customer-requested integrations, enforce plan limits, process subscriptions, prevent abuse, support customers and improve reliability. Marketing contact data is not treated as permission to send marketing email: explicit consent and suppression controls apply to the in-app marketing-email path.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">AI and external providers</h2><p>When you use an AI or connected-provider feature, information needed for that request may be sent to the selected provider. This can include prompts, campaign context, content, media references or publishing instructions. Provider availability, retention and processing are also governed by that provider's terms and privacy practices.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">Marketing contacts</h2><p>If you store leads or customer contacts, you are responsible for having an appropriate basis to use that information. The service's marketing-email feature requires recorded consent, supports suppression and adds an unsubscribe mechanism. Transactional account messages such as password resets are handled separately.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">Storage and security</h2><p>The service uses access controls and server-side storage for customer data. Authentication tokens are stored in the browser's local storage for signed-in sessions. No internet service can guarantee absolute security, so sensitive access credentials should not be pasted into ordinary campaign content or prompts.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">Retention and account requests</h2><p>Information may be retained while an account or service relationship is active and for operational, security, billing or legal reasons afterward where appropriate. Customers can use available account/export controls or contact support to ask about access, correction, export or deletion of account information. Some records may need to be retained where required for billing, fraud prevention, dispute handling or legal obligations.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">Contact</h2><p>Questions or privacy requests can be sent to <a className="text-blue-600 dark:text-blue-400" href="mailto:support@trillionaitech.com">support@trillionaitech.com</a>.</p></section>
        <p className="text-sm text-gray-500">This policy is intended to describe the service's current product behavior. It is not a claim of certification under any particular privacy framework.</p>
      </div>
    </main>
  )
}
