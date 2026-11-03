# Customer-Authorized Paid Advertising Design

## Intent

TrillionAI Marketing may automate paid advertising only inside a spending envelope explicitly authorized by the customer. The product should be simple to configure, transparent about costs, and capable of operating autonomously after the customer presses Start without silently expanding financial authority.

## Customer modes

1. **Manual** — TrillionAI prepares campaigns and recommendations; launch and material spend changes require customer approval.
2. **Automatic within my limits** — TrillionAI may launch, pause, optimise, and reallocate campaigns while remaining inside customer-approved daily and total caps.
3. **Fully automated within my cap** — TrillionAI may operate the campaign portfolio autonomously inside an explicitly approved maximum exposure. This never means unlimited spend.

## Binding controls

- The customer chooses provider accounts, campaign dates, total budget and daily cap.
- Increasing the total cap, daily cap, or automation authority requires fresh authorization.
- TrillionAI may recommend an increase but may not apply it without authorization.
- Provider-side hard stops and spend reconciliation remain mandatory.
- Customers can pause paid advertising immediately.
- Re-authentication or 2FA confirmation is required before activating or expanding financial authority. Only non-secret evidence of that confirmation is stored.

## Cost transparency

Before Start, show separately:

- TrillionAI software/management fee.
- Maximum third-party advertising spend.
- Other separately authorized third-party production costs, if any.
- Maximum total exposure for the authorization period.

Forecasts and performance projections are estimates, never guarantees.

## Audit evidence

Record authorization version, timestamp, customer ID, campaign/budget ID, automation mode, approved caps, currency, and non-secret re-authentication evidence. Do not store plaintext passwords, OTPs, reusable tokens, or other authentication secrets.

## Anti-goals

- No unlimited autonomous spending.
- No silent cap increases.
- No bundled wording that obscures what TrillionAI keeps versus what third parties receive.
- No claim that higher spend guarantees proportional results.
