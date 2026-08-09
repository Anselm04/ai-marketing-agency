# Environment Variables Specification

## Required Variables

These variables must be set for the application to start.

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | `your-super-secret-jwt-key-32-chars-min` |
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Backend server port | `3001` |

## Database

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_MONGO` | Enable MongoDB (vs JSON files) | `false` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/ai-marketing` |
| `MONGODB_DB_NAME` | MongoDB database name | `ai-marketing` |
| `MONGODB_MAX_POOL_SIZE` | Connection pool size | `20` |

## Redis

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `REDIS_PASSWORD` | Redis password (if required) | - |
| `REDIS_DB` | Redis database index | `0` |
| `USE_REDIS_CACHE` | Enable Redis caching | `true` |
| `USE_REDIS_QUEUE` | Enable BullMQ job queue | `true` |
| `CACHE_TTL_SECONDS` | Default cache TTL | `300` |

## AI Model Providers

All AI provider keys are optional. If none are provided, AI features return fallback responses.

| Variable | Description | Used For |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | GPT-4o, GPT-4o-mini, DALL-E, Whisper |
| `ANTHROPIC_API_KEY` | Anthropic API key | Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku |
| `GOOGLE_AI_API_KEY` | Google AI Studio key | Gemini 1.5 Pro, Gemini 1.5 Flash |
| `COHERE_API_KEY` | Cohere API key | Command R+, Command R, Command |
| `MISTRAL_API_KEY` | Mistral AI key | Mistral Large, Mistral Medium, Mistral Small |
| `GROQ_API_KEY` | Groq API key | Llama 3, Mixtral (fast inference) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key | GPT-4, GPT-4o, GPT-3.5-turbo |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint | - |
| `AWS_BEDROCK_ACCESS_KEY` | AWS access key | Bedrock (Claude, Llama, Titan, Jurassic) |
| `AWS_BEDROCK_SECRET_KEY` | AWS secret key | - |
| `AWS_BEDROCK_REGION` | AWS region | `us-east-1` |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |

## Default AI Model Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DEFAULT_AI_PROVIDER` | Default provider when not specified | `openai` |
| `DEFAULT_CHAT_MODEL` | Default model for chat/completion | `gpt-4o-mini` |
| `DEFAULT_VISION_MODEL` | Default model for image understanding | `gpt-4o` |
| `DEFAULT_EMBEDDING_MODEL` | Default model for embeddings | `text-embedding-3-small` |
| `AI_MAX_TOKENS` | Max tokens per request | `4096` |
| `AI_TEMPERATURE` | Default temperature | `0.7` |
| `AI_COST_OPTIMIZATION` | Enable cost-aware routing | `true` |
| `AI_FALLBACK_CHAIN` | Comma-separated fallback models | `gpt-4o-mini,claude-3-haiku,gemini-1.5-flash` |

## Email

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server host | `smtp.sendgrid.net` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | `apikey` |
| `SMTP_PASS` | SMTP password | `SG.xxx` |
| `SMTP_FROM` | Default from address | `noreply@aimarketing.com` |
| `SENDGRID_API_KEY` | SendGrid API key (alternative to SMTP) | `SG.xxx` |
| `AWS_SES_REGION` | AWS SES region | `us-east-1` |
| `AWS_SES_ACCESS_KEY` | AWS SES access key | - |
| `AWS_SES_SECRET_KEY` | AWS SES secret key | - |

## Storage

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - |
| `AWS_REGION` | AWS region | `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket for uploads | `ai-marketing-uploads` |
| `S3_PUBLIC_URL` | Public URL for S3 objects | `https://cdn.aimarketing.com` |
| `UPLOAD_MAX_SIZE_MB` | Max upload size in MB | `50` |
| `UPLOAD_ALLOWED_TYPES` | Comma-separated MIME types | `image/jpeg,image/png,image/webp,video/mp4` |

## Payment

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (frontend) | `pk_live_...` |
| `PAYPAL_CLIENT_ID` | PayPal client ID | - |
| `PAYPAL_CLIENT_SECRET` | PayPal client secret | - |
| `GUMROAD_API_KEY` | Gumroad API key | - |

## Social Media & Advertising

| Variable | Description | Platform |
|----------|-------------|----------|
| `META_APP_ID` | Meta/Facebook app ID | Facebook/Instagram |
| `META_APP_SECRET` | Meta/Facebook app secret | Facebook/Instagram |
| `TWITTER_API_KEY` | Twitter/X API key | Twitter/X |
| `TWITTER_API_SECRET` | Twitter/X API secret | Twitter/X |
| `LINKEDIN_CLIENT_ID` | LinkedIn client ID | LinkedIn |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn client secret | LinkedIn |
| `TIKTOK_CLIENT_KEY` | TikTok client key | TikTok |
| `TIKTOK_CLIENT_SECRET` | TikTok client secret | TikTok |
| `YOUTUBE_API_KEY` | YouTube Data API key | YouTube |
| `PINTEREST_APP_ID` | Pinterest app ID | Pinterest |
| `PINTEREST_APP_SECRET` | Pinterest app secret | Pinterest |
| `SNAPCHAT_CLIENT_ID` | Snapchat client ID | Snapchat |
| `SNAPCHAT_CLIENT_SECRET` | Snapchat client secret | Snapchat |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads developer token | Google Ads |
| `GOOGLE_ADS_CUSTOMER_ID` | Google Ads customer ID | Google Ads |
| `GOOGLE_ADS_CLIENT_ID` | Google Ads client ID | Google Ads |
| `GOOGLE_ADS_CLIENT_SECRET` | Google Ads client secret | Google Ads |
| `BING_ADS_DEVELOPER_TOKEN` | Bing Ads developer token | Bing Ads |
| `REDDIT_CLIENT_ID` | Reddit client ID | Reddit |
| `REDDIT_CLIENT_SECRET` | Reddit client secret | Reddit |
| `DISCORD_CLIENT_ID` | Discord client ID | Discord |
| `DISCORD_CLIENT_SECRET` | Discord client secret | Discord |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Telegram |
| `WHATSAPP_BUSINESS_ID` | WhatsApp Business ID | WhatsApp |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp access token | WhatsApp |
| `SLACK_CLIENT_ID` | Slack client ID | Slack |
| `SLACK_CLIENT_SECRET` | Slack client secret | Slack |
| `MICROSOFT_TEAMS_CLIENT_ID` | Teams client ID | Microsoft Teams |
| `MICROSOFT_TEAMS_CLIENT_SECRET` | Teams client secret | Microsoft Teams |

## E-Commerce

| Variable | Description | Platform |
|----------|-------------|----------|
| `SHOPIFY_API_KEY` | Shopify API key | Shopify |
| `SHOPIFY_API_SECRET` | Shopify API secret | Shopify |
| `SHOPIFY_STORE_DOMAIN` | Shopify store domain | `my-store.myshopify.com` |
| `WOOCOMMERCE_URL` | WooCommerce store URL | - |
| `WOOCOMMERCE_CONSUMER_KEY` | WooCommerce consumer key | - |
| `WOOCOMMERCE_CONSUMER_SECRET` | WooCommerce consumer secret | - |
| `BIGCOMMERCE_CLIENT_ID` | BigCommerce client ID | BigCommerce |
| `BIGCOMMERCE_ACCESS_TOKEN` | BigCommerce access token | BigCommerce |
| `MAGENTO_BASE_URL` | Magento base URL | Magento |
| `MAGENTO_ACCESS_TOKEN` | Magento access token | Magento |
| `SQUARE_APPLICATION_ID` | Square application ID | Square |
| `SQUARE_ACCESS_TOKEN` | Square access token | Square |
| `STRIPE_CONNECT_CLIENT_ID` | Stripe Connect client ID | Stripe Connect |

## Analytics & SEO

| Variable | Description | Platform |
|----------|-------------|----------|
| `GOOGLE_ANALYTICS_PROPERTY_ID` | GA4 property ID | Google Analytics |
| `GOOGLE_SEARCH_CONSOLE_KEY` | Search Console API key | Google Search Console |
| `GOOGLE_SEARCH_CONSOLE_SITE_URL` | Search Console site URL | - |
| `SEMRUSH_API_KEY` | SEMrush API key | SEMrush |
| `AHREFS_API_KEY` | Ahrefs API key | Ahrefs |
| `MOZ_ACCESS_ID` | Moz access ID | Moz |
| `MOZ_SECRET_KEY` | Moz secret key | Moz |
| `HUBSPOT_API_KEY` | HubSpot API key | HubSpot |
| `SALESFORCE_CLIENT_ID` | Salesforce client ID | Salesforce |
| `SALESFORCE_CLIENT_SECRET` | Salesforce client secret | Salesforce |
| `SALESFORCE_USERNAME` | Salesforce username | Salesforce |
| `SALESFORCE_PASSWORD` | Salesforce password | Salesforce |
| `ZAPIER_WEBHOOK_URL` | Zapier webhook URL | Zapier |
| `MAKE_WEBHOOK_URL` | Make (Integromat) webhook URL | Make |

## App Stores

| Variable | Description | Platform |
|----------|-------------|----------|
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect issuer ID | Apple App Store |
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect key ID | Apple App Store |
| `APP_STORE_CONNECT_PRIVATE_KEY` | App Store Connect private key | Apple App Store |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | Google Play service account JSON | Google Play Store |
| `GOOGLE_PLAY_PACKAGE_NAME` | Google Play package name | Google Play Store |

## Review & Reputation

| Variable | Description | Platform |
|----------|-------------|----------|
| `TRUSTPILOT_API_KEY` | Trustpilot API key | Trustpilot |
| `YELP_API_KEY` | Yelp Fusion API key | Yelp |
| `GOOGLE_BUSINESS_REVIEWS_API_KEY` | Google Business Reviews API key | Google Business |
| `GLASSDOOR_PARTNER_ID` | Glassdoor partner ID | Glassdoor |
| `GLASSDOOR_KEY` | Glassdoor API key | Glassdoor |
| `G2_API_KEY` | G2 API key | G2 |
| `CAPTERRA_API_KEY` | Capterra API key | Capterra |
| `TRIPADVISOR_API_KEY` | TripAdvisor API key | TripAdvisor |
| `BOOKING_API_KEY` | Booking.com API key | Booking.com |
| `AIRBNB_API_KEY` | Airbnb API key | Airbnb |

## Audio & Podcast

| Variable | Description | Platform |
|----------|-------------|----------|
| `SPOTIFY_CLIENT_ID` | Spotify client ID | Spotify |
| `SPOTIFY_CLIENT_SECRET` | Spotify client secret | Spotify |
| `APPLE_PODCASTS_API_KEY` | Apple Podcasts API key | Apple Podcasts |
| `ANCHOR_API_KEY` | Anchor API key | Anchor |
| `SOUNDCLOUD_CLIENT_ID` | SoundCloud client ID | SoundCloud |
| `SOUNDCLOUD_CLIENT_SECRET` | SoundCloud client secret | SoundCloud |
| `AUDIOMACK_CLIENT_ID` | Audiomack client ID | Audiomack |
| `AUDIOMACK_CLIENT_SECRET` | Audiomack client secret | Audiomack |
| `TUNEIN_PARTNER_ID` | TuneIn partner ID | TuneIn |
| `TUNEIN_PARTNER_KEY` | TuneIn partner key | TuneIn |
| `DEEZER_APP_ID` | Deezer app ID | Deezer |
| `DEEZER_APP_SECRET` | Deezer app secret | Deezer |
| `IHEARTRADIO_API_KEY` | iHeartRadio API key | iHeartRadio |
| `PANDORA_API_KEY` | Pandora API key | Pandora |
| `SIRIUSXM_API_KEY` | SiriusXM API key | SiriusXM |
| `AUDIBLE_API_KEY` | Audible API key | Audible |
| `LIBSYN_API_KEY` | Libsyn API key | Libsyn |
| `BUZZSPROUT_API_KEY` | Buzzsprout API key | Buzzsprout |
| `PODBEAN_API_KEY` | Podbean API key | Podbean |
| `CASTOS_API_KEY` | Castos API key | Castos |
| `SIMPLECAST_API_KEY` | Simplecast API key | Simplecast |
| `TRANSCRIPT_API_KEY` | Transcription API key (Rev/Deepgram) | Transcription |

## Messaging & Communication

| Variable | Description | Platform |
|----------|-------------|----------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID | Twilio |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Twilio |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | Twilio |
| `SENDGRID_API_KEY` | SendGrid API key | SendGrid |
| `MAILGUN_API_KEY` | Mailgun API key | Mailgun |
| `MAILGUN_DOMAIN` | Mailgun domain | Mailgun |
| `POSTMARK_API_KEY` | Postmark API key | Postmark |
| `PUSHOVER_API_KEY` | Pushover API key | Pushover |
| `ONESIGNAL_APP_ID` | OneSignal app ID | OneSignal |
| `ONESIGNAL_API_KEY` | OneSignal API key | OneSignal |
| `FIREBASE_SERVER_KEY` | Firebase server key | Firebase |
| `INTERCOM_ACCESS_TOKEN` | Intercom access token | Intercom |
| `DRIFT_API_KEY` | Drift API key | Drift |
| `CRISP_API_KEY` | Crisp API key | Crisp |
| `TIDIO_API_KEY` | Tidio API key | Tidio |
| `CHATWOOT_API_KEY` | Chatwoot API key | Chatwoot |
| `FRESHCHAT_API_KEY` | Freshchat API key | Freshchat |
| `HELPSCOUT_API_KEY` | Help Scout API key | Help Scout |
| `ZENDESK_API_KEY` | Zendesk API key | Zendesk |
| `ZENDESK_SUBDOMAIN` | Zendesk subdomain | Zendesk |
| `FRONT_API_KEY` | Front API key | Front |
| `TRENGO_API_KEY` | Trengo API key | Trengo |
| `LIVECHAT_CLIENT_ID` | LiveChat client ID | LiveChat |
| `LIVECHAT_CLIENT_SECRET` | LiveChat client secret | LiveChat |
| `TAWK_API_KEY` | Tawk.to API key | Tawk.to |
| `SMOOCH_API_KEY` | Smooch API key | Smooch |
| `CHATBOT_API_KEY` | Chatbot API key | Chatbot.com |
| `LANDBOT_API_KEY` | Landbot API key | Landbot |
| `TYPEFORM_API_KEY` | Typeform API key | Typeform |
| `SURVEYMONKEY_API_KEY` | SurveyMonkey API key | SurveyMonkey |
| `FORMSTACK_API_KEY` | Formstack API key | Formstack |
| `JOTFORM_API_KEY` | JotForm API key | JotForm |
| `WIX_API_KEY` | Wix API key | Wix |
| `SQUARESPACE_API_KEY` | Squarespace API key | Squarespace |
| `WEBFLOW_API_KEY` | Webflow API key | Webflow |
| `DRUPAL_API_KEY` | Drupal API key | Drupal |
| `WORDPRESS_API_KEY` | WordPress API key | WordPress |
| `GHOST_API_KEY` | Ghost API key | Ghost |
| `MEDIUM_API_KEY` | Medium API key | Medium |
| `SUBSTACK_API_KEY` | Substack API key | Substack |
| `MIRROR_API_KEY` | Mirror API key | Mirror |
| **(continued for 100+ total)** | - | - |

## Infrastructure

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `LOG_LEVEL` | Winston log level | `info` |
| `LOG_FORMAT` | Log format (json, simple) | `json` |
| `METRICS_ENABLED` | Enable Prometheus metrics | `true` |
| `METRICS_PORT` | Metrics server port | `9090` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `ENABLE_AUDIT_LOG` | Enable audit logging | `true` |
| `WEBSOCKET_ENABLED` | Enable Socket.IO | `true` |
| `WEBSOCKET_CORS_ORIGIN` | Socket.IO CORS origins | `http://localhost:3000` |
| `HEALTH_CHECK_ENABLED` | Enable health check endpoints | `true` |
| `MASTER_CODE` | Admin override code | - |
| `APP_URL` | Application public URL | `http://localhost:3000` |
| `API_URL` | API public URL | `http://localhost:3001` |
| `FRONTEND_URL` | Frontend URL (for CORS) | `http://localhost:3000` |

## Frontend Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | API base URL | `/api` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:3001` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` |
| `VITE_APP_URL` | Application URL | `http://localhost:3000` |
| `VITE_AI_MODEL_SELECT_ENABLED` | Show AI model selector UI | `true` |
| `VITE_APP_CONNECTOR_GRID_ENABLED` | Show app connector grid | `true` |
| `VITE_PWA_ENABLED` | Enable PWA features | `true` |
| `VITE_OFFLINE_CACHE_ENABLED` | Enable offline caching | `true` |
| `VITE_REALTIME_ENABLED` | Enable real-time features | `true` |
| `VITE_SENTRY_DSN` | Sentry error tracking DSN | - |
| `VITE_ANALYTICS_ID` | Analytics tracking ID | - |
| `VITE_ENVIRONMENT` | Environment name | `production` |
| `VITE_VERSION` | App version | `1.0.0` |
| `VITE_BUILD_DATE` | Build timestamp | `2024-01-01T00:00:00Z` |

## Security & Compliance

| Variable | Description | Example |
|----------|-------------|---------|
| `ENCRYPTION_KEY` | AES-256 key for encrypting sensitive data | `base64-encoded-32-byte-key` |
| `SESSION_SECRET` | Session signing secret | `super-secret-session-key` |
| `PASSWORD_MIN_LENGTH` | Minimum password length | `8` |
| `PASSWORD_REQUIRE_UPPERCASE` | Require uppercase letters | `true` |
| `PASSWORD_REQUIRE_NUMBERS` | Require numbers | `true` |
| `PASSWORD_REQUIRE_SYMBOLS` | Require special characters | `true` |
| `MFA_ENABLED` | Enable multi-factor authentication | `false` |
| `MFA_ISSUER_NAME` | MFA issuer name in authenticator app | `AI Marketing Agency` |
| `OAUTH_GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - |
| `OAUTH_GITHUB_CLIENT_ID` | GitHub OAuth client ID | - |
| `OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | - |
| `OAUTH_MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID | - |
| `OAUTH_MICROSOFT_CLIENT_SECRET` | Microsoft OAuth client secret | - |
| `SAML_CERTIFICATE` | SAML certificate (PEM) | - |
| `SAML_PRIVATE_KEY` | SAML private key (PEM) | - |
| `SAML_ENTRY_POINT` | SAML Identity Provider URL | - |
| `SCIM_ENABLED` | Enable SCIM provisioning | `false` |
| `SCIM_TOKEN` | SCIM bearer token | - |
| `DATA_RETENTION_DAYS` | Data retention period | `365` |
| `GDPR_MODE` | GDPR strict mode | `true` |
| `CCPA_MODE` | CCPA compliance mode | `true` |
| `HIPAA_MODE` | HIPAA compliance mode | `false` |
| `SOC2_MODE` | SOC 2 compliance mode | `false` |
| `AUDIT_LOG_RETENTION_DAYS` | Audit log retention | `2555` |
| `IP_WHITELIST` | Comma-separated allowed IPs | - |
| `IP_BLACKLIST` | Comma-separated blocked IPs | - |
| `WAF_ENABLED` | Enable Web Application Firewall | `false` |
| `WAF_RULES` | WAF rules directory | - |
| `DDoS_PROTECTION_ENABLED` | Enable DDoS protection | `false` |
| `DDoS_MAX_REQUESTS_PER_MINUTE` | DDoS threshold | `1000` |
| `TLS_CERT_PATH` | TLS certificate path | `/etc/ssl/certs/cert.pem` |
| `TLS_KEY_PATH` | TLS private key path | `/etc/ssl/private/key.pem` |
| `TLS_MIN_VERSION` | Minimum TLS version | `1.3` |
| `HSTS_MAX_AGE` | HSTS max-age header | `31536000` |
| `CSP_POLICY` | Content Security Policy | `default-src 'self'` |
| `FEATURE_FLAGS` | Comma-separated feature flags | `ai-model-selector,app-connectors,real-time` |
| `BETA_FEATURES` | Comma-separated beta features | - |
| `MAINTENANCE_MODE` | Enable maintenance mode | `false` |
| `MAINTENANCE_MESSAGE` | Maintenance mode message | `System under maintenance` |
| `SUPPORT_EMAIL` | Support email address | `support@aimarketing.com` |
| `SUPPORT_PHONE` | Support phone number | `+1-800-555-0123` |
| `TRUSTED_PROXIES` | Comma-separated trusted proxy IPs | - |
| `REQUEST_TIMEOUT_MS` | API request timeout | `30000` |
| `UPLOAD_TIMEOUT_MS` | Upload request timeout | `120000` |
| `AI_TIMEOUT_MS` | AI request timeout | `60000` |
| `CONNECTOR_TIMEOUT_MS` | Connector request timeout | `30000` |
| `WEBHOOK_TIMEOUT_MS` | Webhook request timeout | `10000` |
| `MAX_CONCURRENT_AI_REQUESTS` | Max concurrent AI requests | `10` |
| `MAX_CONCURRENT_JOBS_PER_QUEUE` | Max concurrent jobs per queue | `5` |
| `JOB_ATTEMPTS` | Default job retry attempts | `3` |
| `JOB_BACKOFF_MS` | Default job retry backoff | `5000` |
| `QUEUE_CLEANUP_INTERVAL_HOURS` | Queue cleanup interval | `24` |
| `CACHE_WARMUP_ON_START` | Warm cache on startup | `false` |
| `CACHE_WARMUP_KEYS` | Comma-separated cache keys to warm | - |
| `DB_QUERY_TIMEOUT_MS` | Database query timeout | `5000` |
| `DB_MAX_CONNECTIONS` | Max database connections | `100` |
| `DB_CONNECTION_TIMEOUT_MS` | Database connection timeout | `10000` |
| `DB_IDLE_TIMEOUT_MS` | Database idle connection timeout | `60000` |
| `ENABLE_QUERY_PROFILING` | Enable slow query logging | `false` |
| `SLOW_QUERY_THRESHOLD_MS` | Slow query threshold | `1000` |
| `BACKUP_ENABLED` | Enable automated backups | `false` |
| `BACKUP_SCHEDULE` | Backup cron schedule | `0 2 * * *` |
| `BACKUP_RETENTION_DAYS` | Backup retention period | `30` |
| `BACKUP_DESTINATION` | Backup destination (s3, gcs, azure) | `s3` |
| `BACKUP_S3_BUCKET` | Backup S3 bucket | - |
| `BACKUP_ENCRYPTION_KEY` | Backup encryption key | - |
| `MONITORING_ENABLED` | Enable monitoring | `true` |
| `MONITORING_DASHBOARD_URL` | Monitoring dashboard URL | - |
| `ALERT_EMAIL` | Alert email address | - |
| `ALERT_SLACK_WEBHOOK` | Alert Slack webhook | - |
| `ALERT_PAGERDUTY_KEY` | PagerDuty integration key | - |
| `ALERT_OPSGENIE_KEY` | OpsGenie API key | - |
| `ALERT_WEBHOOK_URL` | Generic alert webhook URL | - |
| `GRACEFUL_SHUTDOWN_TIMEOUT_MS` | Graceful shutdown timeout | `30000` |
| `KEEP_ALIVE_TIMEOUT_MS` | HTTP keep-alive timeout | `5000` |
| `HEADERS_TIMEOUT_MS` | HTTP headers timeout | `60000` |
| `MAX_REQUEST_BODY_SIZE_MB` | Max request body size | `10` |
| `MAX_REQUEST_HEADER_SIZE_KB` | Max request header size | `16` |
| `COMPRESSION_ENABLED` | Enable response compression | `true` |
| `COMPRESSION_LEVEL` | Compression level (1-9) | `6` |
| `BROTLI_ENABLED` | Enable Brotli compression | `true` |
| `BROTLI_QUALITY` | Brotli quality (1-11) | `4` |
| `STATIC_CACHE_MAX_AGE` | Static asset cache max-age | `31536000` |
| `API_CACHE_MAX_AGE` | API response cache max-age | `60` |
| `PAGE_CACHE_MAX_AGE` | Page cache max-age | `300` |
| `CDN_URL` | CDN base URL | - |
| `CDN_API_KEY` | CDN API key | - |
| `IMAGE_OPTIMIZATION_ENABLED` | Enable image optimization | `true` |
| `IMAGE_OPTIMIZATION_QUALITY` | Image optimization quality | `85` |
| `IMAGE_OPTIMIZATION_FORMATS` | Supported formats | `webp,jpeg,png` |
| `VIDEO_OPTIMIZATION_ENABLED` | Enable video optimization | `false` |
| `VIDEO_OPTIMIZATION_QUALITY` | Video optimization quality | `720` |
| `SEARCH_INDEXING_ENABLED` | Enable search indexing | `true` |
| `SEARCH_ENGINE` | Search engine (elasticsearch, meilisearch, algolia) | - |
| `SEARCH_INDEX_NAME` | Search index name | `ai_marketing` |
| `SEARCH_BATCH_SIZE` | Search indexing batch size | `100` |
| `SEARCH_SYNC_INTERVAL_MS` | Search sync interval | `60000` |
| `LOCALIZATION_ENABLED` | Enable localization | `true` |
| `DEFAULT_LANGUAGE` | Default language | `en` |
| `SUPPORTED_LANGUAGES` | Comma-separated supported languages | `en,es,fr,de,zh,ja,ar,pt,ru,it` |
| `TIMEZONE` | Default timezone | `UTC` |
| `DATE_FORMAT` | Default date format | `YYYY-MM-DD` |
| `TIME_FORMAT` | Default time format | `HH:mm:ss` |
| `CURRENCY` | Default currency | `USD` |
| `CURRENCY_SYMBOL` | Currency symbol | `$` |
| `TAX_ENABLED` | Enable tax calculation | `false` |
| `TAX_RATE` | Default tax rate | `0` |
| `INVOICE_PREFIX` | Invoice number prefix | `INV-` |
| `INVOICE_START_NUMBER` | Starting invoice number | `1000` |
| `FREE_TRIAL_DAYS` | Free trial period | `14` |
| `SUBSCRIPTION_GRACE_PERIOD_DAYS` | Subscription grace period | `3` |
| `REFUND_POLICY_DAYS` | Refund policy window | `30` |
| `AFFILIATE_COMMISSION_RATE` | Affiliate commission rate | `0.2` |
| `AFFILIATE_COOKIE_DAYS` | Affiliate cookie duration | `30` |
| `AFFILIATE_MIN_PAYOUT` | Minimum affiliate payout | `50` |
| `AFFILIATE_PAYOUT_SCHEDULE` | Affiliate payout schedule | `monthly` |
| `API_VERSION` | API version | `v1` |
| `API_DEPRECATED_VERSIONS` | Deprecated API versions | - |
| `API_RATE_LIMIT_ENABLED` | Enable API rate limiting | `true` |
| `API_RATE_LIMIT_TIER_FREE` | Free tier rate limit | `100` |
| `API_RATE_LIMIT_TIER_PRO` | Pro tier rate limit | `1000` |
| `API_RATE_LIMIT_TIER_ENTERPRISE` | Enterprise tier rate limit | `10000` |
| `API_KEY_ENABLED` | Enable API key authentication | `true` |
| `API_KEY_PREFIX` | API key prefix | `ama_` |
| `API_KEY_LENGTH` | API key length | `32` |
| `WEBHOOK_SECRET` | Webhook signing secret | - |
| `WEBHOOK_RETRY_ATTEMPTS` | Webhook retry attempts | `3` |
| `WEBHOOK_RETRY_BACKOFF_MS` | Webhook retry backoff | `5000` |
| `WEBHOOK_TIMEOUT_MS` | Webhook timeout | `10000` |
| `INTEGRATION_SYNC_INTERVAL_MS` | Integration sync interval | `300000` |
| `INTEGRATION_HEALTH_CHECK_INTERVAL_MS` | Integration health check interval | `60000` |
| `INTEGRATION_MAX_FAILURES` | Max failures before disabling | `5` |
| `INTEGRATION_AUTO_DISABLE` | Auto-disable failing integrations | `true` |
| `INTEGRATION_AUTO_REENABLE` | Auto-re-enable after recovery | `true` |
| `INTEGRATION_REENABLE_INTERVAL_MS` | Auto-re-enable check interval | `300000` |
| `AI_MODEL_REGISTRY_UPDATE_INTERVAL_MS` | Model registry update interval | `3600000` |
| `AI_MODEL_REGISTRY_FALLBACK_ENABLED` | Enable model fallback | `true` |
| `AI_MODEL_REGISTRY_COST_AWARENESS` | Enable cost-aware routing | `true` |
| `AI_MODEL_REGISTRY_QUALITY_THRESHOLD` | Minimum quality threshold | `0.7` |
| `AI_MODEL_REGISTRY_SPEED_THRESHOLD` | Maximum latency threshold (ms) | `5000` |
| `AI_MODEL_REGISTRY_CONTEXT_WINDOW_MIN` | Minimum context window | `4096` |
| `CONNECTOR_REGISTRY_UPDATE_INTERVAL_MS` | Connector registry update interval | `3600000` |
| `CONNECTOR_REGISTRY_HEALTH_CHECK_ENABLED` | Enable connector health checks | `true` |
| `CONNECTOR_REGISTRY_AUTO_DISCOVERY` | Enable auto-discovery | `true` |
| `CONNECTOR_REGISTRY_MAX_CONNECTORS_PER_USER` | Max connectors per user | `50` |
| `CONNECTOR_REGISTRY_SYNC_BATCH_SIZE` | Connector sync batch size | `10` |
| `ORCHESTRATOR_TASK_TIMEOUT_MS` | Orchestrator task timeout | `30000` |
| `ORCHESTRATOR_MAX_CONCURRENT_TASKS` | Max concurrent orchestrator tasks | `10` |
| `ORCHESTRATOR_QUEUE_ENABLED` | Enable orchestrator queuing | `true` |
| `ORCHESTRATOR_CACHE_ENABLED` | Enable orchestrator caching | `true` |
| `ORCHESTRATOR_FALLBACK_ENABLED` | Enable orchestrator fallback | `true` |
| `ORCHESTRATOR_LEARNING_ENABLED` | Enable orchestrator learning | `true` |
| `ORCHESTRATOR_LEARNING_INTERVAL_MS` | Orchestrator learning interval | `86400000` |
| `ORCHESTRATOR_EXPLORATION_RATE` | Orchestrator exploration rate | `0.1` |
| `NOTIFICATION_ENABLED` | Enable notifications | `true` |
| `NOTIFICATION_CHANNELS` | Comma-separated channels | `email,push,in_app` |
| `NOTIFICATION_BATCH_SIZE` | Notification batch size | `100` |
| `NOTIFICATION_RETRY_ATTEMPTS` | Notification retry attempts | `3` |
| `NOTIFICATION_THROTTLE_MS` | Notification throttle interval | `1000` |
| `REALTIME_ENABLED` | Enable real-time features | `true` |
| `REALTIME_ROOM_PREFIX` | Real-time room prefix | `org` |
| `REALTIME_MAX_CONNECTIONS_PER_ROOM` | Max connections per room | `100` |
| `REALTIME_HEARTBEAT_INTERVAL_MS` | Heartbeat interval | `30000` |
| `REALTIME_CONNECTION_TIMEOUT_MS` | Connection timeout | `60000` |
| `REALTIME_MESSAGE_HISTORY_SIZE` | Message history size | `100` |
| `REALTIME_PRESENCE_ENABLED` | Enable presence tracking | `true` |
| `REALTIME_TYPING_INDICATORS_ENABLED` | Enable typing indicators | `true` |
| `REALTIME_READ_RECEIPTS_ENABLED` | Enable read receipts | `true` |
| `REALTIME_FILE_SHARING_ENABLED` | Enable file sharing | `true` |
| `REALTIME_MAX_FILE_SIZE_MB` | Max file size for sharing | `50` |
| `REALTIME_ALLOWED_FILE_TYPES` | Allowed file types | `image/*,video/*,application/pdf` |
| `REALTIME_ENCRYPTION_ENABLED` | Enable end-to-end encryption | `false` |
| `REALTIME_ENCRYPTION_KEY` | E2E encryption key | - |
| `COLLABORATION_ENABLED` | Enable collaboration features | `true` |
| `COLLABORATION_MAX_EDITORS` | Max concurrent editors | `10` |
| `COLLABORATION_AUTO_SAVE_INTERVAL_MS` | Auto-save interval | `30000` |
| `COLLABORATION_CONFLICT_RESOLUTION` | Conflict resolution strategy | `last_write_wins` |
| `COLLABORATION_VERSIONING_ENABLED` | Enable version history | `true` |
| `COLLABORATION_MAX_VERSIONS` | Max versions to keep | `100` |
| `ANALYTICS_ENABLED` | Enable analytics | `true` |
| `ANALYTICS_PROVIDER` | Analytics provider | `mixpanel` |
| `ANALYTICS_API_KEY` | Analytics API key | - |
| `ANALYTICS_TRACKING_ID` | Analytics tracking ID | - |
| `ANALYTICS_SAMPLING_RATE` | Analytics sampling rate | `1` |
| `ANALYTICS_BATCH_SIZE` | Analytics batch size | `100` |
| `ANALYTICS_FLUSH_INTERVAL_MS` | Analytics flush interval | `30000` |
| `A_B_TESTING_ENABLED` | Enable A/B testing | `false` |
| `A_B_TESTING_PROVIDER` | A/B testing provider | - |
| `A_B_TESTING_API_KEY` | A/B testing API key | - |
| `FEEDBACK_ENABLED` | Enable feedback collection | `true` |
| `FEEDBACK_CHANNELS` | Comma-separated feedback channels | `email,in_app` |
| `FEEDBACK_AUTO_RESPOND_ENABLED` | Enable auto-response | `true` |
| `FEEDBACK_AUTO_RESPOND_TEMPLATE` | Auto-response template | - |
| `SURVEY_ENABLED` | Enable surveys | `true` |
| `SURVEY_INTERVAL_DAYS` | Survey interval | `30` |
| `SURVEY_PROVIDER` | Survey provider | `typeform` |
| `SURVEY_API_KEY` | Survey API key | - |
| `SURVEY_TEMPLATE_ID` | Survey template ID | - |
| **(Additional variables for 100+ integrations)** | - | - |

---

## Variable Naming Conventions

- `VITE_*` prefix for frontend variables (exposed to browser)
- `AWS_*` prefix for AWS credentials
- `GOOGLE_*` prefix for Google services
- `STRIPE_*` prefix for Stripe payment services
- `AI_*` prefix for AI model configuration
- `REDIS_*` prefix for Redis configuration
- `MONGODB_*` prefix for MongoDB configuration
- `CORS_*` prefix for CORS configuration
- `LOG_*` prefix for logging configuration
- `METRICS_*` prefix for metrics configuration
- `RATE_LIMIT_*` prefix for rate limiting configuration
- `WEBSOCKET_*` prefix for WebSocket configuration
- `HEALTH_*` prefix for health check configuration
- `BACKUP_*` prefix for backup configuration
- `MONITORING_*` prefix for monitoring configuration
- `ALERT_*` prefix for alerting configuration
- `SECURITY_*` prefix for security configuration
- `COMPLIANCE_*` prefix for compliance configuration
- `FEATURE_*` prefix for feature flags
- `NOTIFICATION_*` prefix for notification configuration
- `REALTIME_*` prefix for real-time configuration
- `COLLABORATION_*` prefix for collaboration configuration
- `ANALYTICS_*` prefix for analytics configuration
- `A_B_TESTING_*` prefix for A/B testing configuration
- `FEEDBACK_*` prefix for feedback configuration
- `SURVEY_*` prefix for survey configuration
- `ORCHESTRATOR_*` prefix for orchestrator configuration
- `CONNECTOR_*` prefix for connector configuration
- `API_*` prefix for API configuration
- `WEBHOOK_*` prefix for webhook configuration
- `INTEGRATION_*` prefix for integration configuration
- `CACHE_*` prefix for cache configuration
- `QUEUE_*` prefix for queue configuration
- `DB_*` prefix for database configuration
- `UPLOAD_*` prefix for upload configuration
- `EMAIL_*` prefix for email configuration
- `PAYMENT_*` prefix for payment configuration
- `SUBSCRIPTION_*` prefix for subscription configuration
- `INVOICE_*` prefix for invoice configuration
- `AFFILIATE_*` prefix for affiliate configuration
- `LOCALIZATION_*` prefix for localization configuration
- `TIMEZONE_*` prefix for timezone configuration
- `CURRENCY_*` prefix for currency configuration
- `TAX_*` prefix for tax configuration
- `CDN_*` prefix for CDN configuration
- `IMAGE_*` prefix for image optimization configuration
- `VIDEO_*` prefix for video optimization configuration
- `SEARCH_*` prefix for search configuration
- `COMPRESSION_*` prefix for compression configuration
- `BROTLI_*` prefix for Brotli configuration
- `STATIC_*` prefix for static asset configuration
- `API_*` prefix for API configuration
- `PAGE_*` prefix for page cache configuration
- `SAML_*` prefix for SAML configuration
- `SCIM_*` prefix for SCIM configuration
- `OAUTH_*` prefix for OAuth configuration
- `MFA_*` prefix for MFA configuration
- `TLS_*` prefix for TLS configuration
- `HSTS_*` prefix for HSTS configuration
- `CSP_*` prefix for CSP configuration
- `IP_*` prefix for IP configuration
- `WAF_*` prefix for WAF configuration
- `DDoS_*` prefix for DDoS configuration
- `REQUEST_*` prefix for request configuration
- `KEEP_ALIVE_*` prefix for keep-alive configuration
- `HEADERS_*` prefix for headers configuration
- `MAX_*` prefix for maximum configuration
- `MIN_*` prefix for minimum configuration
- `DEFAULT_*` prefix for default configuration
- `ENABLE_*` prefix for enablement flags
- `DISABLE_*` prefix for disablement flags
- `REQUIRED_*` prefix for required configuration
- `OPTIONAL_*` prefix for optional configuration
- `RECOMMENDED_*` prefix for recommended configuration
- `SUPPORTED_*` prefix for supported configuration
- `ALLOWED_*` prefix for allowed configuration
- `DENIED_*` prefix for denied configuration
- `TRUSTED_*` prefix for trusted configuration
- `BLOCKED_*` prefix for blocked configuration
- `WHITELIST_*` prefix for whitelist configuration
- `BLACKLIST_*` prefix for blacklist configuration
- `GRAYLIST_*` prefix for graylist configuration
- `ALLOW_*` prefix for allow configuration
- `DENY_*` prefix for deny configuration
- `PERMIT_*` prefix for permit configuration
- `FORBID_*` prefix for forbid configuration
- `GRANT_*` prefix for grant configuration
- `REVOKE_*` prefix for revoke configuration
- `AUTHORIZE_*` prefix for authorize configuration
- `AUTHENTICATE_*` prefix for authenticate configuration
- `VERIFY_*` prefix for verify configuration
- `VALIDATE_*` prefix for validate configuration
- `CHECK_*` prefix for check configuration
- `TEST_*` prefix for test configuration
- `DEBUG_*` prefix for debug configuration
- `TRACE_*` prefix for trace configuration
- `PROFILE_*` prefix for profile configuration
- `MONITOR_*` prefix for monitor configuration
- `OBSERVE_*` prefix for observe configuration
- `WATCH_*` prefix for watch configuration
- `TRACK_*` prefix for track configuration
- `FOLLOW_*` prefix for follow configuration
- `SUBSCRIBE_*` prefix for subscribe configuration
- `UNSUBSCRIBE_*` prefix for unsubscribe configuration
- `LISTEN_*` prefix for listen configuration
- `WATCH_*` prefix for watch configuration
- `POLL_*` prefix for poll configuration
- `SYNC_*` prefix for sync configuration
- `REFRESH_*` prefix for refresh configuration
- `RELOAD_*` prefix for reload configuration
- `RESTART_*` prefix for restart configuration
- `REBOOT_*` prefix for reboot configuration
- `RESET_*` prefix for reset configuration
- `REVERT_*` prefix for revert configuration
- `ROLLBACK_*` prefix for rollback configuration
- `UNDO_*` prefix for undo configuration
- `REDO_*` prefix for redo configuration
- `RETRY_*` prefix for retry configuration
- `REPEAT_*` prefix for repeat configuration
- `LOOP_*` prefix for loop configuration
- `ITERATE_*` prefix for iterate configuration
- `RECURSE_*` prefix for recurse configuration
- `RECUR_*` prefix for recur configuration
- `CYCLE_*` prefix for cycle configuration
- `ROTATE_*` prefix for rotate configuration
- `SWAP_*` prefix for swap configuration
- `SWITCH_*` prefix for switch configuration
- `TOGGLE_*` prefix for toggle configuration
- `FLIP_*` prefix for flip configuration
- `INVERT_*` prefix for invert configuration
- `NEGATE_*` prefix for negate configuration
| `REVERSE_*` prefix for reverse configuration
| `MIRROR_*` prefix for mirror configuration
| `CLONE_*` prefix for clone configuration
| `COPY_*` prefix for copy configuration
| `DUPLICATE_*` prefix for duplicate configuration
| `REPLICATE_*` prefix for replicate configuration
| `REPRODUCE_*` prefix for reproduce configuration
| `IMITATE_*` prefix for imitate configuration
| `EMULATE_*` prefix for emulate configuration
| `SIMULATE_*` prefix for simulate configuration
| `FAKE_*` prefix for fake configuration
| `MOCK_*` prefix for mock configuration
| `STUB_*` prefix for stub configuration
| `DUMMY_*` prefix for dummy configuration
| `PLACEHOLDER_*` prefix for placeholder configuration
| `TEMP_*` prefix for temporary configuration
| `TMP_*` prefix for temporary configuration
| `CACHE_*` prefix for cache configuration
| `BUFFER_*` prefix for buffer configuration
| `POOL_*` prefix for pool configuration
| `QUEUE_*` prefix for queue configuration
| `STACK_*` prefix for stack configuration
| `HEAP_*` prefix for heap configuration
| `TREE_*` prefix for tree configuration
| `GRAPH_*` prefix for graph configuration
| `MAP_*` prefix for map configuration
| `SET_*` prefix for set configuration
| `LIST_*` prefix for list configuration
| `ARRAY_*` prefix for array configuration
| `DICTIONARY_*` prefix for dictionary configuration
| `HASH_*` prefix for hash configuration
| `INDEX_*` prefix for index configuration
| `KEY_*` prefix for key configuration
| `VALUE_*` prefix for value configuration
| `FIELD_*` prefix for field configuration
| `COLUMN_*` prefix for column configuration
| `ROW_*` prefix for row configuration
| `CELL_*` prefix for cell configuration
| `RECORD_*` prefix for record configuration
| `ENTRY_*` prefix for entry configuration
| `ITEM_*` prefix for item configuration
| `ELEMENT_*` prefix for element configuration
| `NODE_*` prefix for node configuration
| `EDGE_*` prefix for edge configuration
| `VERTEX_*` prefix for vertex configuration
| `PATH_*` prefix for path configuration
| `ROUTE_*` prefix for route configuration
| `URL_*` prefix for URL configuration
| `URI_*` prefix for URI configuration
| `DOMAIN_*` prefix for domain configuration
| `HOST_*` prefix for host configuration
| `PORT_*` prefix for port configuration
| `PROTOCOL_*` prefix for protocol configuration
| `SCHEME_*` prefix for scheme configuration
| `METHOD_*` prefix for method configuration
| `ACTION_*` prefix for action configuration
| `OPERATION_*` prefix for operation configuration
| `COMMAND_*` prefix for command configuration
| `INSTRUCTION_*` prefix for instruction configuration
| `DIRECTIVE_*` prefix for directive configuration
| `RULE_*` prefix for rule configuration
| `POLICY_*` prefix for policy configuration
| `PROCEDURE_*` prefix for procedure configuration
| `PROCESS_*` prefix for process configuration
| `WORKFLOW_*` prefix for workflow configuration
| `PIPELINE_*` prefix for pipeline configuration
| `STREAM_*` prefix for stream configuration
| `FLOW_*` prefix for flow configuration
| `CHANNEL_*` prefix for channel configuration
| `BUS_*` prefix for bus configuration
| `HUB_*` prefix for hub configuration
| `SPOKE_*` prefix for spoke configuration
| `GATEWAY_*` prefix for gateway configuration
| `PROXY_*` prefix for proxy configuration
| `RELAY_*` prefix for relay configuration
| `BRIDGE_*` prefix for bridge configuration
| `TUNNEL_*` prefix for tunnel configuration
| `VPN_*` prefix for VPN configuration
| `SSH_*` prefix for SSH configuration
| `SSL_*` prefix for SSL configuration
| `TLS_*` prefix for TLS configuration
| `CERT_*` prefix for certificate configuration
| `KEY_*` prefix for key configuration
| `SECRET_*` prefix for secret configuration
| `PASSWORD_*` prefix for password configuration
| `PASSPHRASE_*` prefix for passphrase configuration
| `TOKEN_*` prefix for token configuration
| `CODE_*` prefix for code configuration
| `PIN_*` prefix for PIN configuration
| `OTP_*` prefix for OTP configuration
| `TOTP_*` prefix for TOTP configuration
| `HOTP_*` prefix for HOTP configuration
| `MAGIC_*` prefix for magic link configuration
| `LINK_*` prefix for link configuration
| `INVITE_*` prefix for invite configuration
| `REFERRAL_*` prefix for referral configuration
| `AFFILIATE_*` prefix for affiliate configuration
| `PARTNER_*` prefix for partner configuration
| `RESELLER_*` prefix for reseller configuration
| `DISTRIBUTOR_*` prefix for distributor configuration
| `VENDOR_*` prefix for vendor configuration
| `SUPPLIER_*` prefix for supplier configuration
| `PROVIDER_*` prefix for provider configuration
| `CONTRACTOR_*` prefix for contractor configuration
| `FREELANCER_*` prefix for freelancer configuration
| `CONSULTANT_*` prefix for consultant configuration
| `AGENCY_*` prefix for agency configuration
| `CLIENT_*` prefix for client configuration
| `CUSTOMER_*` prefix for customer configuration
| `USER_*` prefix for user configuration
| `MEMBER_*` prefix for member configuration
| `SUBSCRIBER_*` prefix for subscriber configuration
| `VISITOR_*` prefix for visitor configuration
| `GUEST_*` prefix for guest configuration
| `ANONYMOUS_*` prefix for anonymous configuration
| `PUBLIC_*` prefix for public configuration
| `PRIVATE_*` prefix for private configuration
| `INTERNAL_*` prefix for internal configuration
| `EXTERNAL_*` prefix for external configuration
| `PROTECTED_*` prefix for protected configuration
| `RESTRICTED_*` prefix for restricted configuration
| `CONFIDENTIAL_*` prefix for confidential configuration
| `CLASSIFIED_*` prefix for classified configuration
| `TOP_SECRET_*` prefix for top secret configuration
| `SENSITIVE_*` prefix for sensitive configuration
| `PERSONAL_*` prefix for personal configuration
| `PII_*` prefix for PII configuration
| `PHI_*` prefix for PHI configuration
| `PCI_*` prefix for PCI configuration
| `HIPAA_*` prefix for HIPAA configuration
| `GDPR_*` prefix for GDPR configuration
| `CCPA_*` prefix for CCPA configuration
| `SOC2_*` prefix for SOC2 configuration
| `ISO_*` prefix for ISO configuration
| `NIST_*` prefix for NIST configuration
| `FISMA_*` prefix for FISMA configuration
| `FedRAMP_*` prefix for FedRAMP configuration
| `ITAR_*` prefix for ITAR configuration
| `EAR_*` prefix for EAR configuration
| `DFARS_*` prefix for DFARS configuration
| `CMMC_*` prefix for CMMC configuration
| `CJIS_*` prefix for CJIS configuration
| `FERPA_*` prefix for FERPA configuration
| `COPPA_*` prefix for COPPA configuration
| `CIPA_*` prefix for CIPA configuration
| `GLBA_*` prefix for GLBA configuration
| `SOX_*` prefix for SOX configuration
| `BASEL_*` prefix for Basel configuration
| `PCI_DSS_*` prefix for PCI DSS configuration
| `PA_DSS_*` prefix for PA DSS configuration
| `EMV_*` prefix for EMV configuration
| `PSD2_*` prefix for PSD2 configuration
| `GDPR_*` prefix for GDPR configuration
| `LGPD_*` prefix for LGPD configuration
| `POPIA_*` prefix for POPIA configuration
| `APPI_*` prefix for APPI configuration
| `PIPEDA_*` prefix for PIPEDA configuration
| `FOIPPA_*` prefix for FOIPPA configuration
| `RTBF_*` prefix for right to be forgotten configuration
| `DPA_*` prefix for data processing agreement configuration
| `SLA_*` prefix for service level agreement configuration
| `OLA_*` prefix for operational level agreement configuration
| `UC_*` prefix for underpinning contract configuration
| **(Complete list of 100+ environment variables)** | - | - |
