# AI Marketing Agency — System Architecture

## Overview

The AI Marketing Agency is a full-stack monolithic application built with a service-oriented backend and a React SPA frontend. It is designed to evolve into a horizontally scalable, multi-tenant platform with real-time capabilities, universal AI model support, and dynamic app connector orchestration.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Clients                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Web SPA  │  │ Mobile   │  │ API      │  │ Webhook  │           │
│  │ (React)  │  │ (Future) │  │ Clients  │  │ Receivers│           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
└───────┼─────────────┼─────────────┼─────────────┼─────────────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Edge Layer                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Nginx / CDN (SSL, Gzip, Brotli, Rate Limit, Cache)        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API Gateway (Future)                            │
│  Auth, Routing, Rate Limiting, Request Validation, Metrics          │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Application Layer                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Express.js Monolith (Node.js 20+)                          │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │  │
│  │  │  Auth        │ │  AI Core     │ │  Connectors  │         │  │
│  │  │  Service     │ │  Engine      │ │  Framework   │         │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘         │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │  │
│  │  │  Campaigns   │ │  CRM         │ │  Analytics   │         │  │
│  │  │  Studio      │ │  Pipeline    │ │  Engine      │         │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Service Layer                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ AI Model │  │ App      │  │Intelligent│  │ Real-Time │           │
│  │ Registry │  │ Connector│  │Orchestrator│  │ Events   │           │
│  │ Service  │  │ Service  │  │ Service  │  │ Service   │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Billing  │  │ Email    │  │ Upload   │  │ Scheduler │           │
│  │ (Stripe) │  │ (Nodemailer│  │ (S3)    │  │ (Cron)    │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Data & Infrastructure Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ MongoDB  │  │ Redis    │  │ Redis    │  │ S3 /     │           │
│  │ (Primary │  │ (Cache)  │  │ (Queue)  │  │ Storage  │           │
│  │  Store)  │  │          │  │          │  │          │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐                                         │
│  │ Winston  │  │ Prometheus│                                         │
│  │ (Logs)   │  │ (Metrics)│                                         │
│  └──────────┘  └──────────┘                                         │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    External Providers                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ OpenAI   │  │ Anthropic│  │ Google   │  │ Cohere   │  │ Mistral│ │
│  │ GPT-4o   │  │ Claude   │  │ Gemini   │  │ Command  │  │ Mixtral│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Groq     │  │ Azure    │  │ AWS      │  │ Ollama   │  │ 100+   │ │
│  │ Llama    │  │ OpenAI   │  │ Bedrock  │  │ Local    │  │ Apps   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React | 18.3.1 | UI framework |
| Frontend | Vite | 5.4.21 | Build tool & dev server |
| Frontend | Tailwind CSS | 3.4.19 | Styling |
| Frontend | React Router | 6.30.4 | Client-side routing |
| Frontend | Recharts | 2.15.4 | Data visualization |
| Frontend | Socket.IO Client | 4.7.5 | Real-time communication |
| Backend | Node.js | >=20.0.0 | Runtime |
| Backend | Express | 4.19.2 | Web framework |
| Backend | Socket.IO | 4.7.5 | Real-time events |
| Backend | MongoDB | 7.x | Primary database |
| Backend | Redis | 7.x | Cache & job queue |
| Backend | BullMQ | 5.x | Background job queue |
| Backend | Winston | 3.13.0 | Structured logging |
| Backend | Prometheus | - | Metrics collection |
| Infrastructure | Docker | 24+ | Containerization |
| Infrastructure | Nginx | 1.25+ | Reverse proxy |
| Infrastructure | GitHub Actions | - | CI/CD |
| Infrastructure | Vercel | - | Frontend hosting |

## Core Design Patterns

### 1. Dual-Adapter Database Pattern
The system supports both JSON file storage (for development/demo) and MongoDB (for production) via a unified adapter interface. The active adapter is selected at runtime based on environment variables.

### 2. Service-Oriented Architecture
Business logic is encapsulated in domain services (`src/services/`) with clear interfaces. Each service is independently testable and can be replaced without affecting route handlers.

### 3. Middleware Pipeline
All HTTP requests flow through a standardized middleware pipeline:
1. Security headers (Helmet)
2. CORS validation
3. Request logging (Morgan)
4. Body parsing & sanitization
5. Authentication (JWT verification)
6. Rate limiting
7. Audit logging
8. Route handler
9. Error handling

### 4. Real-Time Event Architecture
Socket.IO rooms are scoped by organization ID. Events flow:
- Agent status updates → `org:${orgId}:agents`
- Notification broadcasts → `org:${orgId}:notifications`
- Task progress → `user:${userId}:tasks`
- System alerts → `org:${orgId}:system`

### 5. AI Model Abstraction
The `aiModelRegistry` provides a unified interface across all AI providers. Each provider implements a standard contract:
- `generateChatCompletion(messages, options)`
- `generateCompletion(prompt, options)`
- `streamChatCompletion(messages, options)`
- `getModelInfo(modelId)`
- `estimateCost(prompt, options)`

### 6. App Connector Framework
Connectors are self-describing configuration objects with:
- Metadata (name, category, icon, description)
- OAuth 2.0 configuration (scopes, endpoints)
- API contract (operations, webhooks, rate limits)
- Health check endpoint
- Error handling & retry strategy

### 7. Intelligent Orchestration
The orchestrator uses a rule-based + ML scoring system to match tasks to the optimal AI model and app connectors:
- **Task Analysis**: Intent classification, content type, complexity, urgency
- **Model Scoring**: Quality score, speed score, cost score, context window fit
- **Connector Scoring**: User has active connection, connector health, data freshness, rate limit availability
- **Decision**: Weighted scoring with configurable thresholds

## Data Flow

### Authentication Flow
```
Client → POST /api/auth/register
       → Server hashes password, stores user in DB
       → Server generates JWT (7-day expiry)
       → Returns { token, user }
       → Client stores token in localStorage
       → All subsequent requests include Bearer token
       → Server verifies JWT on each request
```

### AI Generation Flow
```
Client → POST /api/campaigns/:id/strategy
       → Server validates request (Zod schema)
       → Orchestrator analyzes task requirements
       → Orchestrator selects optimal AI model
       → Server calls AI Model Registry
       → If queue is enabled, job is queued via BullMQ
       → If real-time, progress events sent via Socket.IO
       → Server returns result or job ID
       → Client polls or listens for completion
```

### App Connector Flow
```
Client → GET /api/connectors (list available)
       → Client clicks "Connect" on a connector
       → Server initiates OAuth 2.0 flow
       → User authenticates with external provider
       → Provider redirects with authorization code
       → Server exchanges code for access/refresh tokens
       → Server stores encrypted tokens in DB
       → Connector status: "connected"
       → Orchestrator can now use this connector for tasks
```

## Scalability Strategy

### Current State: Monolithic (Phase 1)
- Single Express server
- JSON or single MongoDB instance
- In-memory rate limiting
- Suitable for < 100 concurrent users

### Phase 2: Containerized Monolith
- Docker containers with Nginx load balancer
- Redis for sessions and caching
- BullMQ for background jobs
- MongoDB replica set
- Suitable for 1,000 concurrent users

### Phase 3: Service Decomposition (Future)
- Auth service (JWT, OAuth, session management)
- AI Core service (model registry, prompt management, caching)
- Connector service (OAuth, webhook management, API proxying)
- Campaign service (CRUD, scheduling, analytics)
- Real-time service (Socket.IO, notifications, events)
- Suitable for 10,000+ concurrent users

## Security Architecture

### Authentication
- JWT with RS256 (asymmetric signing) in production
- Password hashing with bcrypt (12 rounds minimum)
- Refresh token rotation with secure HTTP-only cookies
- OAuth 2.0 + OIDC for social login

### Authorization
- RBAC with roles: `user`, `admin`, `super_admin`
- Organization-scoped data access
- Resource-level permissions (owner, editor, viewer)
- API key management with scoped permissions

### Data Protection
- TLS 1.3 for all external communication
- AES-256 encryption for sensitive data at rest (tokens, API keys)
- Input sanitization (XSS, SQL injection prevention)
- Output encoding for all user-generated content

### Infrastructure Security
- Nginx WAF rules (rate limiting, bot detection)
- Container security (non-root users, read-only filesystems)
- Secret management (environment variables, key vaults)
- Automated vulnerability scanning (Snyk, npm audit)

## Monitoring & Observability

### Metrics (Prometheus)
- `http_requests_total` — Counter, labeled by method, route, status
- `http_request_duration_seconds` — Histogram, labeled by route
- `ai_requests_total` — Counter, labeled by provider, model, status
- `ai_request_duration_seconds` — Histogram, labeled by provider, model
- `connector_requests_total` — Counter, labeled by connector, operation, status
- `queue_jobs_total` — Counter, labeled by queue, status
- `active_users` — Gauge, labeled by org
- `db_connections` — Gauge
- `cache_hit_ratio` — Gauge

### Logs (Winston + ELK/Loki)
- Request logs (method, path, status, duration, user, org)
- Error logs (stack trace, context, request ID)
- Audit logs (who changed what, when, from where)
- AI logs (prompt, response, model, cost, latency)
- Connector logs (operation, payload, response, errors)

### Tracing (OpenTelemetry — Future)
- Distributed tracing across all services
- Trace AI model calls and connector operations
- Database query tracing
- Frontend performance tracking

## Deployment Architecture

### Development
```
docker-compose up
  → MongoDB (localhost:27017)
  → Redis (localhost:6379)
  → Backend (localhost:3001)
  → Frontend dev server (localhost:3000)
```

### Production (Docker Swarm / Kubernetes — Future)
```
Nginx (SSL termination, load balancing)
  → Backend replicas (3+ instances)
  → Redis cluster (cache + queue)
  → MongoDB replica set (3+ nodes)
  → Prometheus + Grafana (monitoring)
  → ELK Stack (logging)
```

### CI/CD Pipeline
```
Git Push
  → GitHub Actions
    → Lint + Type Check
    → Unit Tests (Jest + Vitest)
    → Integration Tests
    → Security Scan (Snyk, npm audit)
    → Build Docker Images
    → Push to Registry
    → Deploy to Staging
    → E2E Tests
    → Deploy to Production (Blue-Green)
```

## Future Roadmap

### Near Term (3 months)
- Multi-model AI support with cost optimization
- 50 production-ready app connectors
- Real-time collaboration features
- Mobile-responsive PWA
- Advanced analytics with cohort analysis

### Medium Term (6 months)
- Service decomposition into microservices
- Kubernetes deployment with auto-scaling
- Advanced ML-based orchestrator
- White-label / multi-tenant customization
- Enterprise SSO (SAML, SCIM)

### Long Term (12 months)
- AI agent marketplace (third-party agents)
- Cross-platform campaign orchestration
- Predictive analytics with custom ML models
- Voice / video generation pipeline
- Global CDN with edge AI inference
