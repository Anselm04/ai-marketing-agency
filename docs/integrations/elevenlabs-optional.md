# Optional voice provider: ElevenLabs

Status: **not activated**. This repository does not require an ElevenLabs account or subscription.

An isolated Node.js adapter exists at `backend/src/integrations/elevenlabs.js`.
It is intentionally **not wired to routes, jobs, scheduled tasks, or agent tools**.
There is no automatic traffic and no paid calls from this change.

## Activation requirements (future only)
- Approval by the business owner after a genuine product use case and budget exist
- Owner-controlled ElevenLabs account and API key, provisioned through the secret manager
- Explicit entitlement, usage metering and budget ceilings in the calling workflow
- Customer authorisation and consent for any cloned voices or publication
- A tested route/job for one narrowly defined use case
- Real-cost and voice-quality benchmarking before broader rollout

## Environment variables

All are server-side only; never put these in the Flutter or web frontend.

| Name | Default | Description |
| --- | --- | --- |
| `ELEVENLABS_ENABLED` | unset (off) | Must equal `true` to permit calls |
| `ELEVENLABS_API_KEY` | unset | Provider secret, obtained later |
| `ELEVENLABS_VOICE_ID` | unset | Approved voice ID |
| `ELEVENLABS_MODEL_ID` | `eleven_multilingual_v2` | Optional speech model |

No valid API credentials are included in source control. The adapter will
throw `VoiceProviderDisabledError` unless explicitly configured and called.
There is no public route, agent action, automatic retries or fallback.

The adapter caps text input and output size and applies an HTTP timeout.
Those caps **are not financial limits**; before enabling any production workflow,
add authenticated authorization, customer usage metering, per-account quotas,
global spending caps and audited consent.

To test without an account, run the project's backend Jest tests. The integration
tests use a local fetch mock and never contact ElevenLabs.

Note: voice providers are replaceable dependencies. TrillionAI maintains
ownership of its workflows and may add a proprietary voice engine later.
