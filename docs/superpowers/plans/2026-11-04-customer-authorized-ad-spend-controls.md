# Customer-Authorized Ad Spend Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make paid advertising operate only inside customer-approved spending rules, with clear manual/limited/full-auto modes, explicit maximum exposure, strong confirmation, and auditable re-authorization for increases.

**Architecture:** Extend the existing paid-ad budget model and orchestrator rather than replacing it. Store an immutable authorization snapshot alongside each paid-ad budget, enforce it in launch/reconciliation/update paths, expose customer-friendly controls in the existing paid-ads UI, and require fresh authorization whenever limits or automation authority increase.

**Tech Stack:** Node.js/Express backend, existing store abstraction/Postgres, React frontend, existing paid advertising provider adapters and Stripe management-fee checkout.

**Spec:** Conversation agreement dated 2026-11-04.

## Global Constraints

- Customer controls all advertising spend limits.
- Automation may act only within the customer's explicitly authorized envelope.
- Budget increases and broader automation authority require fresh customer authorization.
- Customers must see TrillionAI fees, third-party advertising spend, other authorized costs, and maximum total exposure separately before starting.
- Fully automated mode must never mean unlimited spend.
- A customer can pause paid advertising immediately.
- Performance forecasts must be presented as estimates, never guarantees.
- Preserve existing provider-side hard stops, spend reconciliation, and production-certification gates.

## Review Focus

- Attempts to increase a budget without a fresh authorization snapshot must fail.
- Attempts to switch from manual/limited to broader automation without fresh authorization must fail.
- Provider spend reaching the approved cap must stop further automated execution.
- Cost summaries must not merge TrillionAI fees and third-party ad spend into a misleading single charge.
- Re-authentication evidence must never store plaintext passwords or reusable authentication secrets.

---

### Task 1: Authorization policy model and enforcement

**Files:**
- Modify: `backend/src/services/paidAdvertisingService.js`
- Modify: `backend/src/routes/paidAds.js`
- Test: existing paid-ad service/route test files discovered in repository

**Interfaces:**
- Consumes: existing paid-ad budgets and managed provider account data.
- Produces: automation mode, authorization snapshot, maximum exposure summary, and fresh-authorization checks used by update/activate paths.

- [ ] Write failing tests for manual, bounded-auto, and full-auto-with-cap modes.
- [ ] Write failing tests proving increased limits/authority are rejected without fresh authorization.
- [ ] Add authorization normalization and comparison helpers.
- [ ] Enforce fresh authorization on create/update/activate.
- [ ] Run targeted tests and commit.

### Task 2: Audit evidence and safe confirmation metadata

**Files:**
- Modify: paid-ad persistence/service files discovered in repository.
- Test: existing paid-ad tests.

**Interfaces:**
- Consumes: authenticated user/session context plus authorization request metadata.
- Produces: timestamped immutable authorization records containing agreement version, approved caps, automation mode, and non-secret re-auth/2FA evidence.

- [ ] Write failing tests for authorization record creation and immutability.
- [ ] Persist authorization events without plaintext credentials.
- [ ] Return the active authorization summary to the UI.
- [ ] Run targeted tests and commit.

### Task 3: Customer-friendly paid advertising setup UI

**Files:**
- Modify: existing paid-ads React page/components discovered in repository.
- Test: existing frontend paid-ad tests if present.

**Interfaces:**
- Consumes: paid-ad policy and active authorization from API.
- Produces: setup flow for Manual, Automatic within my limits, and Fully automated within my cap; sliders/amount inputs; separated cost summary; confirmation state; pause control.

- [ ] Add mode selection and plain-language descriptions.
- [ ] Add campaign/daily cap controls and maximum exposure summary.
- [ ] Add explicit confirmation copy and re-auth/2FA confirmation hook before Start.
- [ ] Show recommendations as advisory only; never auto-raise a cap.
- [ ] Run frontend tests/build and commit.

### Task 4: Closed-loop safeguards and verification

**Files:**
- Modify: `backend/src/services/paidAdvertisingOrchestratorService.js`
- Modify: managed paid-ad execution/reconciliation files as needed.
- Test: paid-ad orchestration tests.

**Interfaces:**
- Consumes: active customer authorization and reconciled provider spend.
- Produces: hard-stop behavior at approved caps and no escalation without authorization.

- [ ] Add failing tests for cap reached, paused, expired authorization, and unauthorized escalation.
- [ ] Enforce cap before launch/optimization/reallocation operations.
- [ ] Preserve provider certification and reconciliation requirements.
- [ ] Run paid-ad suite, repository tests, lint/build where available.
- [ ] Open a pull request with the customer-safety behavior documented.
