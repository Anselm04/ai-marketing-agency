# TrillionAI voice harness — dormant by design

This feature branch provides an **optional, server-side interface** for future voice services.
It does not create or require an ElevenLabs account, subscription, API key, job,
customer-facing route, agent tool, UI, deployment, or scheduled task.

## Current contract

- `voiceCapabilities(env)`: read-only discovery, with `enabled: false`.
- `requestVoice(...)`: explicit, gated text-to-speech request.
- `synthesizeElevenLabs(...)`: provider-specific adapter; only called by the
  harness after passing gates when the feature is eventually enabled.

The harness supports `elevenlabs` only. A future TrillionAI proprietary model
or alternative provider must be added through an explicit reviewed adapter.

## Default-off controls

`TRILLIONAI_VOICE_WORKFLOWS_ENABLED` is **unset/false** by default and must
be exactly `true` before the harness can issue any call. ElevenLabs has its
independent `ELEVENLABS_ENABLED` flag and requires server-side key and voice ID.
Even when both flags are on, a trusted server-side caller must provide a verified
authorisation that binds the tenant, selected provider and task and confirms
consent, entitlement/metering readiness and spending approval.

**Important:** The authorisation object in this preparatory harness is a
contract, not a security boundary. It must never be populated from user
input or exposed through a public API. Before production activation, implement
and test authoritative middleware, persisted budget counters, reservation and
reconciliation of usage, idempotency, rate limits, and audit trails.
Do not expose the harness to public routes or autonomous agents until then.

## Future ecosystem integration

Keep the provider in the backend only; Flutter and web clients should talk to
their product-specific authenticated backend. TrillionAI Marketing can be the
first controlled integration. AppForge, Manager, Education and TrillionEngine
may use a shared service later, **only after separate authorised integrations**
and strict tenant isolation. This branch changes no other repository.

## Offline validation

Run the backend Jest suite. Harness tests exercise the disabled state,
failure of missing authorisation fields and a mock audio response. They make
zero real provider calls, consume zero provider credits and do not require
an ElevenLabs account.

## Activation policy

Defer paid subscriptions and real API use until an actual product workflow
is ready, costs are budgeted and the company owner explicitly authorises
activation. The future proprietary TrillionAI Voice model is a separate,
later-stage research investment, not a prerequisite for this integration.
