# AI Marketing Agency

An autonomous, full-stack, AI-driven marketing system designed to run your entire business's promotional engine with minimal human intervention. Engineered for maximum scalability, performance, and revenue generation.

## What This App Does

- Autonomously markets iOS and Android apps on App Store and Google Play
- Runs full-stack advertising, social media, SEO, legal compliance, and revenue optimization
- Generates and optimizes campaigns across TikTok, Instagram, Facebook, YouTube, LinkedIn, Twitter/X, Reddit, and Google Ads
- Provides real-time analytics, AI content generation, and automated customer engagement

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + Socket.IO Client |
| Backend | Node.js + Express + ESM |
| AI Engine | Multi-Provider Registry (OpenAI, Anthropic, Google, Cohere, Mistral, Groq, Azure, AWS Bedrock, Ollama) + LangChain |
| Queue | BullMQ + Redis |
| Cache | Redis with in-memory fallback |
| Database | MongoDB + File-based store (development) |
| Real-time | Socket.IO |
| Monitoring | Prometheus metrics + health checks |
| DevOps | Docker + Docker Compose + GitHub Actions CI/CD |

## Production Features

### AI Model Registry
- **9 providers**, **40+ models** with auto-discovery
- Cost estimation, quality scoring, and fallback chains
- Streaming support and vision model support
- Configurable via environment variables

### App Connector Framework
- **100+ connectors** across social, e-commerce, ads, CRM, and messaging platforms
- OAuth2 + API key authentication patterns
- Built-in health checks and retry logic
- Extensible architecture for new platforms

### Intelligent Orchestrator
- Contextual task routing to optimal AI models
- Smart suggestions based on user behavior and campaign data
- Performance tracking with auto-scoring

### Production Utilities
- **Queue System**: BullMQ with Redis for background jobs
- **Caching**: Redis with graceful in-memory fallback
- **Validation**: Zod schemas for type-safe request validation
- **WebSockets**: Real-time notifications and agent status updates
- **Health Checks**: `/live`, `/ready`, `/health` endpoints
- **Metrics**: Prometheus-compatible metrics at `/metrics`
- **Logging**: Structured JSON logging with Winston
- **Security**: Helmet headers, CORS, rate limiting, input sanitization, audit logging
- **Pagination**: Cursor-based pagination helper

### Real-Time Frontend
- Live dashboard with Socket.IO integration
- Real-time notifications and task progress
- Campaign activity feed
- Connection status monitoring with auto-reconnect

## Quick Start

### Prerequisites
- Node.js >= 20
- Redis (optional, in-memory fallback available)
- MongoDB (optional, file-based store available for development)

### Installation

```bash
# Clone repository
git clone https://github.com/Anselm04/ai-marketing-agency.git
cd ai-marketing-agency

# Install dependencies (workspaces)
npm install

# Environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# Development (both frontend and backend)
npm run dev

# Or separately
cd backend && npm run dev
cd frontend && npm run dev
```

### Docker

```bash
docker-compose up --build
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health: http://localhost:3001/health
- Metrics: http://localhost:3001/metrics

## API Endpoints

See `backend/API.md` for full endpoint documentation.

Key endpoints:
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - Authentication
- `GET /api/agents` - List AI agents
- `POST /api/campaigns` - Create campaign
- `POST /api/content` - Generate content
- `GET /api/ai-models` - AI model registry
- `GET /api/connectors` - App connectors
- `GET /health` - Health checks
- `GET /metrics` - Prometheus metrics

## Environment Variables

See `backend/ENV.md` for full environment documentation.

Required:
- `JWT_SECRET` - Authentication secret
- `PORT` - Backend port (default: 3001)

Optional (for AI providers):
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_AI_API_KEY`
- `COHERE_API_KEY`
- `MISTRAL_API_KEY`
- `GROQ_API_KEY`
- `AZURE_OPENAI_API_KEY`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
- `OLLAMA_BASE_URL`

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## Deployment

### Docker Compose (Production)
```bash
docker-compose -f docker-compose.yml up -d
```

### Manual
1. Build frontend: `cd frontend && npm run build`
2. Serve static files via nginx or `npm run preview`
3. Start backend: `cd backend && npm start`
4. Configure reverse proxy (see `nginx.conf`)

## Security

- Helmet security headers
- CORS whitelist configuration
- Rate limiting per endpoint
- Input sanitization (XSS prevention)
- JWT authentication with bcrypt
- Audit logging for sensitive operations
- File upload validation and size limits

## Documentation

- `ARCHITECTURE.md` - System architecture and design decisions
- `API.md` - Full API endpoint documentation
- `ENV.md` - Environment variable reference
- `PLAN.md` - Development roadmap and feature plan

## License

MIT License

## Developer

Built by Anselm Stephen John Perkins

## Vision

> "This app markets itself into the world — and in doing so, proves it can market anything else just as effectively."
