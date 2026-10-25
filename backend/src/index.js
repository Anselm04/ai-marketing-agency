import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

import { logger } from './utils/logger.js';
import store from './utils/store.js';

import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import campaignRoutes from './routes/campaigns.js';
import analyticsRoutes from './routes/analytics.js';
import contentRoutes from './routes/content.js';
import crmRoutes from './routes/crm.js';
import billingPublicRoutes from './routes/billingPublic.js';
import billingRoutes, { stripeWebhookHandler } from './routes/billing.js';
import adminRoutes from './routes/admin.js';
import teamRoutes from './routes/team.js';
import settingsRoutes from './routes/settings.js';
import socialRoutes from './routes/social.js';
import exportRoutes from './routes/export.js';
import aiModelsRoutes from './routes/aiModels.js';
import connectorsRoutes from './routes/connectors.js';
import orchestratorRoutes from './routes/orchestrator.js';
import productsRoutes from './routes/products.js';
import legalRoutes from './routes/legal.js';
import trendsRoutes from './routes/trends.js';
import translationRoutes from './routes/translation.js';
import videoRoutes from './routes/video.js';
import schedulerRoutes from './routes/scheduler.js';
import uploadsRoutes from './routes/uploads.js';
import searchRoutes from './routes/search.js';
import realtimeRoutes from './routes/realtime.js';
import affiliateRoutes from './routes/affiliate.js';
import appforgeIntegrationRoutes from './routes/appforgeIntegration.js';
import clippingRoutes from './routes/clipping.js';
import courseFactoryRoutes from './routes/courseFactory.js';
import courseFactoryMediaRoutes from './routes/courseFactoryMedia.js';
import socialVideoRoutes from './routes/socialVideo.js';
import mediaLibraryRoutes from './routes/mediaLibrary.js';
import autoPostingRoutes from './routes/autoPosting.js';
import paidAdsRoutes from './routes/paidAds.js';
import adsRoutes from './routes/ads.js';
import usageRoutes from './routes/usage.js';
import unsubscribeRoutes from './routes/unsubscribe.js';
import autoPostingService from './services/autoPostingService.js';
import { getMarketingEntitlement } from './services/marketingEntitlementService.js';
import clippingSchedulerService from './services/clippingSchedulerService.js';
import { openaiStatus } from './services/openaiService.js';
import { costControlStatus } from './services/costControlStatus.js';
import { hydrateStripeWebhookSecret } from './services/runtimeSecretService.js';
import './services/withUserTokensPatch.js';

import { metricsRouteHandler } from './utils/metrics.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { sanitizeBody } from './middleware/sanitize.js';
import { auditLog } from './middleware/auditLog.js';

if (process.env.NODE_ENV === 'production' && store.isPostgres?.() !== true) {
  throw new Error(
    'Production startup blocked: Marketing Agency must use Supabase/PostgreSQL persistence.',
  );
}

await store.connectDB();

const stripeWebhookReady = await hydrateStripeWebhookSecret();
if (process.env.NODE_ENV === 'production' && !stripeWebhookReady) {
  throw new Error(
    'Production startup blocked: Stripe webhook verification secret is not available from Fly environment or Supabase Vault.',
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = process.env.FRONTEND_DIST || path.resolve(__dirname, '../../frontend/dist');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

const defaultOrigins = 'http://localhost:3000,http://localhost:5173,http://localhost:8080';
const originSource = process.env.CORS_ORIGIN || [process.env.APP_URL, defaultOrigins].filter(Boolean).join(',');
const whitelist = originSource.split(',').map((s) => s.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Trillion-Source',
    'X-Trillion-Timestamp',
    'X-Trillion-Signature',
  ],
};

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(cors(corsOptions));
app.use(compression());
app.use(morgan('combined'));
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
app.use('/api/unsubscribe', unsubscribeRoutes);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeBody);
app.use(rateLimit);

app.get('/health', async (_req, res) => {
  try {
    await store.connectDB();
    res.json({ status: 'ok', database: store.isPostgres?.() ? 'postgres' : 'local', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Health check failed', { error: error?.message });
    res.status(503).json({ status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await store.connectDB();
    const persistence = store.getPersistenceInfo
      ? store.getPersistenceInfo()
      : { mode: store.isPostgres?.() ? 'supabase-postgres' : 'local-json' };
    const ai = openaiStatus();
    res.json({
      status: 'ok',
      service: 'trillionai-marketing',
      timestamp: new Date().toISOString(),
      database: store.isPostgres?.() ? 'postgres' : 'local',
      persistence,
      openai: ai,
      billing: {
        stripeApiConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        stripeWebhookVerificationConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      },
      costControls: costControlStatus(),
    });
  } catch (error) {
    logger.error('API health check failed', { error: error?.message });
    res.status(503).json({ status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() });
  }
});

app.get('/metrics', metricsRouteHandler);

app.use('/api/auth', auditLog, authRoutes);
app.use('/api/billing', billingPublicRoutes);
app.use('/api/integrations/appforge', appforgeIntegrationRoutes);
app.use((req, res, next) => {
  if (req.path.startsWith('/api/integrations/appforge')) return next();
  if (req.path === '/api/billing/webhook') return next();
  if (req.path.startsWith('/api/unsubscribe')) return next();
  if (/^\/api\/connectors\/[^/]+\/callback$/.test(req.path)) return next();
  if (/^\/api\/social\/oauth\/[^/]+\/callback$/.test(req.path)) return next();
  if (req.path.startsWith('/api')) return authenticate(req, res, next);
  return next();
});
app.use('/api', auditLog);
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();

  const freeAccountPaths = [
    '/api/billing',
    '/api/settings',
    '/api/admin',
    '/api/unsubscribe',
  ];
  const isPersonalPortfolioRead =
    req.method === 'GET' && req.path === '/api/products/portfolio';
  const isSocialOAuthCallback =
    req.method === 'GET' && /^\/api\/social\/oauth\/[^/]+\/callback$/.test(req.path);
  const isConnectorOAuthCallback =
    req.method === 'GET' && /^\/api\/connectors\/[^/]+\/callback$/.test(req.path);

  if (freeAccountPaths.some((prefix) => req.path.startsWith(prefix)) || isPersonalPortfolioRead || isSocialOAuthCallback || isConnectorOAuthCallback) {
    return next();
  }

  const entitlement = await getMarketingEntitlement(req.user);
  if (!entitlement.entitled) {
    return res.status(402).json({
      error: 'An active Marketing subscription or valid plan god code is required.',
      code: 'marketing_entitlement_required',
      billingPath: '/dashboard/billing',
    });
  }
  req.marketingEntitlement = entitlement;
  return next();
});
app.use('/api/agents', agentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/ai-models', aiModelsRoutes);
app.use('/api/connectors', connectorsRoutes);
app.use('/api/orchestrator', orchestratorRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/clipping', clippingRoutes);
app.use('/api/course-factory', courseFactoryRoutes);
app.use('/api/course-factory', courseFactoryMediaRoutes);
app.use('/api/social-video', socialVideoRoutes);
app.use('/api/media-library', mediaLibraryRoutes);
app.use('/api/auto-posting', autoPostingRoutes);
app.use('/api/paid-ads', paidAdsRoutes);
app.use('/api/usage', usageRoutes);

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/metrics') {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, '0.0.0.0', () => {
    clippingSchedulerService.start();
    autoPostingService.start();
    logger.info(`Server running on port ${PORT}`, {
      environment: process.env.NODE_ENV,
      frontendDist: fs.existsSync(frontendDist) ? frontendDist : 'none',
      persistence: store.isPostgres?.() ? 'supabase-postgres' : 'local-json',
    });
  });
}

const shutdown = async () => {
  try {
    clippingSchedulerService.stop();
    autoPostingService.stop();
    await store.disconnectDB();
  } finally {
    if (httpServer.listening) {
      httpServer.close(() => process.exit(0));
    } else {
      process.exit(0);
    }
  }
};

if (process.env.NODE_ENV !== 'test') {
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export default app;