# Marketing DB + OAuth status

## Database

- **Code (main):** `store.js` selects `postgresStore` when `DATABASE_URL` or `SUPABASE_DB_URL` is set; production refuses to boot otherwise.
- **Supabase project:** `yihcwxmcvmcquvsulqkv` (`supabase-chestnut-ball`) hosts `marketing.*` tables (shared with AppForge org).
- **Live Fly** (`trillionai-marketing.fly.dev`) still runs an older image that reports `postgres-url-set-but-json-adapter-active` even though `DATABASE_URL` is set — **redeploy main** (out of scope for this task) is required for Postgres to become active.
- **Do not invent** `DATABASE_URL`. Reuse the existing Fly secret, or copy AppForge’s Supabase DB URL for project `yihcwxmcvmcquvsulqkv` (`db.yihcwxmcvmcquvsulqkv.supabase.co`).
- OAuth tokens are stored encrypted in `marketing.settings` via `appConnector.storeTokens` (access token, refresh token, and non-public account ids such as the Page token).
- Connection metadata uses `marketing.social_connections` (migration `marketing_social_connections_and_media`). The OAuth callback awaits the upsert.

## OAuth platforms + env vars

| Platform | Client ID env | Client secret env | What a successful connect stores |
|----------|---------------|-------------------|-----------------------------------|
| X / Twitter | `TWITTER_CLIENT_ID` or `TWITTER_API_KEY` | `TWITTER_CLIENT_SECRET` or `TWITTER_API_SECRET` | User access + refresh (`offline.access`, PKCE). A bearer token does not post as the user. |
| TikTok | `TIKTOK_CLIENT_KEY` or `TIKTOK_CLIENT_ID` | `TIKTOK_CLIENT_SECRET` | User access + refresh. Authorize uses `client_key` and PKCE. Direct Post stays `TIKTOK_PRIVACY_LEVEL=SELF_ONLY` until the app is audited. Needs a public `videoUrl`. |
| Facebook | `META_APP_ID` or `FACEBOOK_APP_ID` | `META_APP_SECRET` or `FACEBOOK_APP_SECRET` | Long-lived user token plus the granted Page id. Text posts go to `/{page-id}/feed` with the Page token. |
| Instagram | same Meta app | same Meta secret | Instagram professional id linked to that Page. Image posts and Reels use `/{ig-user-id}/media` then `media_publish`. Text-only is rejected. |
| LinkedIn | `LINKEDIN_CLIENT_ID` | `LINKEDIN_CLIENT_SECRET` | Member URN from OpenID `userinfo`. Text posts use the Posts API (`w_member_social`), not `urn:li:person:me`. |
| YouTube | `GOOGLE_CLIENT_ID` or `YOUTUBE_CLIENT_ID` | `GOOGLE_CLIENT_SECRET` or `YOUTUBE_CLIENT_SECRET` | Access + refresh. Organic publish uploads a public https `videoUrl` (privacy `YOUTUBE_PRIVACY_STATUS`, default `private`). There is no text-post API. |
| Google Ads | `GOOGLE_ADS_CLIENT_ID` or `GOOGLE_CLIENT_ID` | `GOOGLE_ADS_CLIENT_SECRET` or `GOOGLE_CLIENT_SECRET` | Ads connector only. Not an organic post target. |

Redirect URI pattern (register each one on the provider app):

- `https://trillionai-marketing.fly.dev/api/social/oauth/x/callback`
- `https://trillionai-marketing.fly.dev/api/social/oauth/tiktok/callback`
- `https://trillionai-marketing.fly.dev/api/social/oauth/facebook/callback`
- `https://trillionai-marketing.fly.dev/api/social/oauth/instagram/callback`
- `https://trillionai-marketing.fly.dev/api/social/oauth/linkedin/callback`
- `https://trillionai-marketing.fly.dev/api/social/oauth/youtube/callback`

Also set, all to `https://trillionai-marketing.fly.dev`:

- `API_URL` (this is what the code puts in `redirect_uri`; if it is unset the code defaults to the Fly host)
- `PUBLIC_URL`
- `FRONTEND_URL` (browser returns here after connect)

Also required before a real connect succeeds:

- `DATABASE_URL` (existing Fly secret; do not invent one)
- `ENCRYPTION_KEY` or `JWT_SECRET` of at least 32 characters (tokens are encrypted at rest)
- `META_GRAPH_VERSION` (example `v21.0`; do not leave Facebook on retired Graph v18)
- `LINKEDIN_VERSION` (example `202609`)
- Optional selectors when several Pages are granted: `FACEBOOK_PAGE_ID`, `INSTAGRAM_USER_ID`

App credentials are **not** in the repo and must not be invented. Create each provider app, register the callback URLs above, then set the secrets on the deployment. This change does not deploy to Fly.

## Email (later)

- **Inbound:** Cloudflare Email Routing for `trillionaitech.com` (MX → `route*.mx.cloudflare.net`; SPF `include:_spf.mx.cloudflare.net`). Routes `hello@` / `support@` / `anselm@` to Anselm’s real mailbox.
- **Outbound (AppForge / brand site):** Resend API (`RESEND_API_KEY`) from `hello@trillionaitech.com`, `support@trillionaitech.com`, `anselm@trillionaitech.com`.
- **Marketing later:** set `RESEND_API_KEY` + `FROM_EMAIL=hello@trillionaitech.com` (or `noreply@…` once verified in Resend) on `trillionai-marketing`. Code already supports Resend SMTP in `emailService.js`.
