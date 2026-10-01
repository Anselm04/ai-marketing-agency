# Marketing DB + OAuth status

## Database

- **Code (main):** `store.js` selects `postgresStore` when `DATABASE_URL` or `SUPABASE_DB_URL` is set; production refuses to boot otherwise.
- **Supabase project:** `yihcwxmcvmcquvsulqkv` (`supabase-chestnut-ball`) hosts `marketing.*` tables (shared with AppForge org).
- **Live Fly** (`trillionai-marketing.fly.dev`) still runs an older image that reports `postgres-url-set-but-json-adapter-active` even though `DATABASE_URL` is set — **redeploy main** (out of scope for this task) is required for Postgres to become active.
- **Do not invent** `DATABASE_URL`. Reuse the existing Fly secret, or copy AppForge’s Supabase DB URL for project `yihcwxmcvmcquvsulqkv` (`db.yihcwxmcvmcquvsulqkv.supabase.co`).
- OAuth tokens are stored encrypted in `marketing.settings` via `appConnector.storeTokens`.
- Connection metadata uses `marketing.social_connections` (migration `marketing_social_connections_and_media`).

## OAuth platforms + env vars

| Platform | Client ID env | Client secret env |
|----------|---------------|-------------------|
| X / Twitter | `TWITTER_CLIENT_ID` or `TWITTER_API_KEY` | `TWITTER_CLIENT_SECRET` or `TWITTER_API_SECRET` |
| TikTok | `TIKTOK_CLIENT_KEY` or `TIKTOK_CLIENT_ID` | `TIKTOK_CLIENT_SECRET` |
| Instagram / Facebook / Meta Ads | `META_APP_ID` or `FACEBOOK_APP_ID` | `META_APP_SECRET` or `FACEBOOK_APP_SECRET` |
| LinkedIn | `LINKEDIN_CLIENT_ID` | `LINKEDIN_CLIENT_SECRET` |
| YouTube | `GOOGLE_CLIENT_ID` or `YOUTUBE_CLIENT_ID` | `GOOGLE_CLIENT_SECRET` or `YOUTUBE_CLIENT_SECRET` |
| Google Ads | `GOOGLE_ADS_CLIENT_ID` or `GOOGLE_CLIENT_ID` | `GOOGLE_ADS_CLIENT_SECRET` or `GOOGLE_CLIENT_SECRET` |

Redirect URI pattern: `https://trillionai-marketing.fly.dev/api/social/oauth/<platform>/callback`  
(`x`, `tiktok`, `instagram`, `facebook`, `linkedin`, `youtube`, `meta`, `google`)

Also set: `API_URL`, `FRONTEND_URL`, `PUBLIC_URL` = `https://trillionai-marketing.fly.dev`

AppForge Fly env list does **not** include these social OAuth client secrets — create apps in each provider console and `fly secrets set` on `trillionai-marketing`.

## Email (later)

- **Inbound:** Cloudflare Email Routing for `trillionaitech.com` (MX → `route*.mx.cloudflare.net`; SPF `include:_spf.mx.cloudflare.net`). Routes `hello@` / `support@` / `anselm@` to Anselm’s real mailbox.
- **Outbound (AppForge / brand site):** Resend API (`RESEND_API_KEY`) from `hello@trillionaitech.com`, `support@trillionaitech.com`, `anselm@trillionaitech.com`.
- **Marketing later:** set `RESEND_API_KEY` + `FROM_EMAIL=hello@trillionaitech.com` (or `noreply@…` once verified in Resend) on `trillionai-marketing`. Code already supports Resend SMTP in `emailService.js`.
