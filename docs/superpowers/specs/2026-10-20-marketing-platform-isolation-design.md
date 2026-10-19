# AI Marketing Agency — Independent Platform & Dependency Architecture

Date: 2026-10-20
Repository: `Anselm04/ai-marketing-agency`
Status: Design for implementation review

## Goal

Make the AI Marketing Agency a real, independently deployable production application using the same provider accounts where sensible, while keeping every resource isolated from AppForge and all future products.

Standing architecture rule:

**Shared provider account → separate app-specific projects/resources.**

AppForge may be inspected as a precedent for proven patterns, but no AppForge production resource, secret, database, queue, Stripe object, OAuth credential, deployment target, or runtime state may be reused by the Marketing Agency.

## Current verified state

- GitHub repository is already independent: `Anselm04/ai-marketing-agency`.
- Fly configuration already targets its own app name: `trillionai-marketing` in Sydney.
- Existing Fly config still has legacy/early-stage settings including `USE_REDIS_QUEUE = "false"`, local volume persistence, and a frontend/API deployment model that needs production hardening.
- Current Vercel source config contained a placeholder API origin. A correction has been committed on `fix/vercel-production-routing`, but the connected Vercel team currently exposes no linked Vercel project for this repository, so deployment cannot yet be qualified.
- Supabase account currently exposes existing projects, but none has been verified as a dedicated Marketing Agency production project.
- Stripe access is through the existing shared live Stripe account `Trillionaitech`; Marketing Agency must use app-specific Stripe products/prices/webhooks/configuration within that account rather than a second Stripe account.
- GitHub Actions and production deployment remain separate from Vercel and must be qualified independently.

## Isolation model

Each Marketing Agency dependency must have its own product-scoped identity:

| Provider | Shared account allowed | Marketing-specific isolation required |
|---|---|---|
| GitHub | Yes | dedicated repository, branches, Actions config, secrets |
| Vercel | Yes | dedicated Vercel project linked only to this repo |
| Fly.io | Yes | dedicated Fly app, machines, volumes, secrets |
| Supabase/Postgres | Yes | dedicated project/database and credentials |
| Redis | Yes | dedicated Redis database/instance/namespace and credentials |
| Stripe | Yes | dedicated products, prices, webhook endpoint, metadata namespace and app configuration |
| OAuth providers | Yes where provider supports one owner account | dedicated OAuth app/client where practical; never AppForge client IDs/secrets |
| Storage | Yes | dedicated bucket/path policy and credentials |
| Monitoring/analytics | Yes | dedicated project/service/environment tags |
| Email | Yes | dedicated sender/domain/configuration where required |
| Automation/webhooks | Yes | dedicated workflow/webhook endpoints and signing secrets |

## Target topology

### Frontend

Vercel hosts the production Vite frontend as a dedicated project linked to `Anselm04/ai-marketing-agency`.

- framework: Vite
- source: repository root/monorepo with explicit frontend build settings
- build: `npm run build --workspace=frontend`
- output: `frontend/dist`
- API requests: rewrite `/api/*` to the Marketing Agency Fly API only
- SPA fallback: `index.html`
- no AppForge domains, project IDs or environment variables

### Backend

Fly hosts the Marketing Agency Node backend in the dedicated app `trillionai-marketing`.

- API origin: `https://trillionai-marketing.fly.dev` unless a dedicated production API domain is assigned later
- secrets remain in Fly, not Git
- production readiness must fail closed when required infrastructure is unavailable
- HTTP scheduler duplication must be removed as durable worker/scheduler infrastructure is introduced

### Database

Create or verify a dedicated Marketing Agency PostgreSQL database, preferably a separate Supabase project under the shared owner organization.

- unique project/database credentials
- migrations tracked in this repository
- no AppForge schemas or data
- production backend uses the Marketing Agency `DATABASE_URL` only
- backup/restore and migration checks are product scoped

### Queue and autonomous runtime

Provision a dedicated Redis resource for the Marketing Agency and enable BullMQ production operation.

- separate Redis URL/credentials
- no production in-memory fallback for critical money/publishing jobs
- durable job state, idempotency, retries, dead-letter handling and reconciliation
- distributed locks for schedulers and publishing
- readiness should reflect required Redis availability where critical

### Stripe

Use the existing `Trillionaitech` Stripe account, but isolate Marketing Agency billing inside it.

- dedicated Marketing Agency products and prices
- dedicated webhook endpoint for the Marketing Agency backend
- dedicated webhook signing secret
- app-specific metadata namespace on customers/subscriptions/checkout sessions
- environment variables in Marketing Agency only
- never reuse AppForge price IDs or webhook secrets
- local entitlement state changes only after Stripe confirmation

### OAuth and publishing

Each provider connection used by the Marketing Agency must be separately registered/configured for this application where supported.

- X
- Meta/Facebook/Instagram
- LinkedIn
- YouTube/Google
- TikTok
- any later paid-ad providers

OAuth state, PKCE, callback URLs, encrypted tokens, refresh flows, scopes and revocation are all Marketing-specific. AppForge OAuth apps/credentials are not reused.

### Storage/media

Marketing-generated media and uploads must use dedicated storage isolation. Existing local Fly volume storage may remain only where appropriate for transitional/noncritical local files; production media requiring durability/scaling should use a dedicated object-storage namespace/bucket.

### Observability

Use shared provider accounts but dedicated Marketing Agency service/project identity in monitoring systems. Logs, traces, alerts and dashboards must be filterable without AppForge data.

## Dependency order

Implementation must proceed in prerequisite order and each section must be finished and verified before merge:

1. **Repository/release gate** — deterministic install/lint/test/build, GitHub Actions execution, Vercel project linkage, Vercel frontend build, Fly deployment path.
2. **Database foundation** — dedicated database, migrations, constraints, production connection, backup/recovery checks.
3. **Redis/queue foundation** — dedicated Redis, BullMQ fail-closed production mode, worker lifecycle, idempotency, retries/dead-letter/reconciliation.
4. **Durable orchestration** — persistent tasks/history/status, scheduler deduplication, distributed locks, recovery.
5. **AI providers** — unified provider routing, structured validation, real fallback providers, cost/accounting persistence.
6. **Billing** — Marketing-specific Stripe products/prices/webhooks and production qualification.
7. **Organic OAuth/publishing** — provider-by-provider real E2E qualification.
8. **Paid advertising** — real Meta/Google Ads adapters, status/spend/control flows.
9. **Analytics/attribution/optimisation** — unified measurement and closed-loop optimisation.
10. **Auth/security/operations** — verification, session/device controls, distributed rate limiting, audit/export/delete, health/readiness/alerts.
11. **Production qualification** — end-to-end customer journey and provider failure/recovery paths.

## Merge discipline

For each subsystem:

**inspect prerequisites → finish → strengthen → verify → commit → merge normally → re-check main → next**

- short-lived branch only
- no PR backlog
- no force merges
- no merge when executable qualification did not run
- implementation written is not the same as production qualified
- external blockers are labeled blocked/unverified rather than replaced with fake behavior

## Cost control

- Reuse shared provider accounts where appropriate.
- Create separate product-scoped resources, not separate top-level accounts.
- Do not provision paid resources or increase plan costs without explicit confirmation when the provider/tool reports a nonzero charge.
- Do not use Sprites for work that direct provider/GitHub tools can perform.

## Immediate implementation slice

The first bounded execution slice after approval of this design is:

1. Establish the dedicated Vercel project for `Anselm04/ai-marketing-agency` under the connected Vercel team.
2. Apply explicit Vite monorepo build/output settings.
3. Deploy `fix/vercel-production-routing` as a preview.
4. Read the real Vercel build logs and fix all source/configuration failures in that same branch.
5. Verify `/` and `/api/*` routing against the Marketing Agency Fly backend.
6. Qualify the GitHub Actions release gate separately.
7. Merge only when this release-foundation slice is working.

After that, the next prerequisite is the dedicated Marketing Agency database project and migration foundation.
