# Integrations Guide

## Available Integrations (28 total)

### Social Media
- **Twitter/X** - OAuth 2.0 - Post tweets, threads, analytics
- **LinkedIn** - OAuth 2.0 - Company posts, articles, analytics
- **Instagram** - OAuth 2.0 - Posts, stories, reels
- **Facebook** - OAuth 2.0 - Pages, groups, ads
- **TikTok** - OAuth 2.0 - Videos, trends
- **YouTube** - OAuth 2.0 - Videos, shorts, analytics
- **Pinterest** - OAuth 2.0 - Pins, boards
- **Reddit** - OAuth 2.0 - Subreddit posts
- **Discord** - Webhook - Server announcements

### Email & Marketing
- **Mailchimp** - API key - Campaigns, audiences
- **SendGrid** - API key - Transactional emails

### E-commerce
- **Shopify** - OAuth 2.0 - Store products, orders
- **Etsy** - OAuth 2.0 - Listings, shop management
- **Amazon** - API key - Product listings

### Advertising
- **Google Ads** - OAuth 2.0 - Campaigns, keywords
- **Meta Ads** - OAuth 2.0 - Facebook/Instagram ads
- **TikTok Ads** - OAuth 2.0 - Video ads

### CRM & Productivity
- **HubSpot** - API key - Contacts, deals
- **Salesforce** - OAuth 2.0 - Leads, opportunities
- **Notion** - API key - Pages, databases
- **Airtable** - API key - Bases, records
- **Slack** - API key - Channels, messages
- **Zoom** - OAuth 2.0 - Meetings, webinars
- **Microsoft Teams** - Webhook - Channel messages
- **Calendly** - API key - Event scheduling

### Content
- **WordPress** - Basic auth - Posts, pages
- **Canva** - OAuth 2.0 - Design templates

### Payments
- **Stripe** - API key - Payments, subscriptions

## Authentication Types
- **OAuth 2.0**: Redirects to provider, returns access token
- **API Key**: Direct key input in dashboard
- **Basic Auth**: Username/password for WordPress
- **Webhook**: URL endpoint for Discord/Teams

## API Endpoints
- `GET /api/integrations` - List available
- `GET /api/integrations/status` - Get connection status
- `POST /api/integrations/:id/connect` - Connect integration
- `POST /api/integrations/:id/disconnect` - Disconnect
- `POST /api/integrations/:id/test` - Test connection
- `GET /api/integrations/:id/oauth-url` - Get OAuth URL
- `POST /api/integrations/:id/publish` - Publish content
- `GET /api/integrations/:id/analytics` - Get analytics
