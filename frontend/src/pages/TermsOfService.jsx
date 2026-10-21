import { Link } from 'react-router-dom'

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-5 py-12 space-y-8">
        <div>
          <Link to="/" className="text-sm text-blue-600 dark:text-blue-400">← AI Marketing Agency</Link>
          <h1 className="mt-4 text-3xl font-bold">Terms of Service</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: 21 October 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Service</h2>
          <p>The TrillionAI AI Marketing Agency provides software-assisted marketing planning, content generation, campaign management, CRM, automation and supported provider integrations. Features can depend on your plan, connected accounts, provider permissions and external-platform availability.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">AI-generated work</h2>
          <p>AI output is working material, not a guarantee of accuracy, legal compliance, platform approval, sales, leads, rankings, conversion rates, revenue or return on advertising spend. You are responsible for reviewing claims, prices, offers, rights, brand statements and other material before using or publishing it.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Your data, contacts and content</h2>
          <p>You must have the rights and permissions needed for content, media, customer data and contact information you upload or use. You must not use the service to send unlawful spam, impersonate others, infringe intellectual-property rights, deceive consumers or conduct prohibited or abusive activity.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Publishing and external platforms</h2>
          <p>Public publishing occurs only through supported connected accounts and depends on external-provider APIs, permissions, policies and availability. A feature shown in the application does not guarantee that a third-party provider will approve or accept a particular post, campaign or account action.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Paid advertising</h2>
          <p>Subscription fees do not include advertising media spend. Paid advertising requires separate customer action and budget controls. The service must not be treated as authority to spend advertising money unless you have explicitly configured and approved that activity. A provider path that cannot be safely controlled may be blocked rather than launched.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Subscriptions and limits</h2>
          <p>Paid plans are billed using the price and billing interval shown at checkout. Plan limits may restrict campaigns, agent access, publishing volume, seats or provider usage. A subscription may be scheduled for cancellation at the end of the current billing period where that option is available. You remain responsible for charges validly incurred before cancellation takes effect.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Refunds and billing disputes</h2>
          <p>Refund eligibility depends on the circumstances, the terms presented at purchase and applicable law. If you believe a charge is incorrect, contact <a className="text-blue-600 dark:text-blue-400" href="mailto:support@trillionaitech.com">support@trillionaitech.com</a> promptly so it can be investigated. Do not treat an AI-generated response as a billing decision.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Availability and changes</h2>
          <p>The service may change as providers, APIs and product capabilities change. Temporary outages, provider failures and maintenance can occur. Where a capability is unsafe, unavailable or no longer supported, it may be disabled rather than simulated.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Account security</h2>
          <p>You are responsible for keeping account credentials secure and for activity performed through your account or connected provider accounts. Notify support if you believe an account or integration has been compromised.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p>Questions about these terms can be sent to <a className="text-blue-600 dark:text-blue-400" href="mailto:support@trillionaitech.com">support@trillionaitech.com</a>.</p>
        </section>

        <p className="text-sm text-gray-500">These terms describe the current service and do not create guarantees about external platform behavior or marketing outcomes.</p>
      </div>
    </main>
  )
}
