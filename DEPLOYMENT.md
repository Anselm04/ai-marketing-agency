# Deployment Guide

## Prerequisites
- Node.js 20+
- MongoDB 6+
- Redis 7+
- Nginx (production)
- Docker (optional)

## Environment Variables

```bash
# Core
NODE_ENV=production
PORT=3001
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-byte-hex-key

# Database
MONGODB_URI=mongodb://localhost:27017/ai_marketing
REDIS_URL=redis://localhost:6379

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
MISTRAL_API_KEY=...
COHERE_API_KEY=...

# Optional: Azure, AWS, Ollama
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_KEY=...
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
OLLAMA_URL=http://localhost:11434

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=...

# Storage (S3-compatible)
S3_ENDPOINT=...
S3_BUCKET=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Sentry (optional)
SENTRY_DSN=https://...
```

## Local Development
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Production Build
```bash
# Frontend
cd frontend
npm run build

# Backend (use PM2 or systemd)
cd backend
NODE_ENV=production node src/index.js
```

## Docker
```bash
docker build -t ai-marketing-backend ./backend
docker build -t ai-marketing-frontend ./frontend
docker-compose up -d
```

## Nginx Setup
```bash
# Copy config
sudo cp nginx.conf /etc/nginx/sites-available/ai-marketing
sudo ln -s /etc/nginx/sites-available/ai-marketing /etc/nginx/sites-enabled/

# SSL with Let's Encrypt
sudo certbot --nginx -d yourdomain.com

sudo nginx -t
sudo systemctl reload nginx
```

## Health Checks
- `GET /health` - Overall system health
- `GET /health/ai` - AI provider status
- `GET /health/integrations` - Integration status
- `GET /metrics` - Prometheus metrics

## Monitoring
- Prometheus metrics at `/metrics`
- Winston JSON logs to stdout
- Sentry for error tracking

## Database Migrations
```bash
cd backend
node scripts/migrate.js
node scripts/seed.js
```
