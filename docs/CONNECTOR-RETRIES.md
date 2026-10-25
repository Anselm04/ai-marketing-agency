# Connector failure and retry behavior

Connector retries run within the original request; there is no background retry processor. Failed campaign connector results explicitly return `retryQueued:false` and `backgroundRetryAvailable:false`. The orchestrator does not add `CONNECTOR_SYNC` jobs that have no consumer.

- Only GET operations can retry automatically. The default is one additional attempt; operation definitions can set zero or at most three additional attempts. Invalid retry counts disable retries.
- Retries apply to HTTP 5xx responses and connection-reset/timeout failures. Authentication, permission, client-input and rate-limit responses are returned without automatic retry. Delays between read attempts are 1, 2 and 4 seconds.
- After a transient read failure, the orchestrator tries each distinct selected connector at most once, in selection order. Each connector must define the same operation as GET. A permanent failure ends fallback.
- POST, PATCH, PUT and DELETE operations receive one attempt and never switch accounts after an error. A timed-out write may already have reached the provider; check the provider outcome before a deliberate manual retry.
- A history/logging failure after provider success does not replay the provider operation.

Existing Redis jobs from older builds are not processed or deleted by this change. Any future background worker must reconcile those jobs and establish provider idempotency, account authorization, durable job state and failure visibility before replaying writes. The generic queue utility remains available for separately implemented consumers.
