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
import billingRoutes from './routes/billing.js';
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

import { metricsRouteHandler } from './utils/metrics.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { sanitizeBody } from './middleware/sanitize.js';

// Never allow the current local JSON persistence layer to masquerade as a
// production database. Fly/Vercel filesystems are not the durable source of
// truth for customer, campaign, lead, billing, or authentication records.
// This guard stays until the active route store is migrated to Supabase/Postgres.
if (process.env.NODE_ENV === 'production' && store.isMongo?.() === false) {
  throw new Error(
    'Production startup blocked: Marketing Agency still uses local JSON persistence. Migrate the active store to Supabase/PostgreSQL before production deployment.',
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = process.env.FRONTEND_DIST || path.resolve(__dirname, '../../frontend/dist');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

const defaultOrigins = 'http://localhost:3000,http://localhost:5173,http://localhost:8080';
const originSource = process.env.CORS_ORIGIN || [process.env.APP_URL, defaultOrigins].filter(Boolean).join(',');
const whitelist = originSource.split(',').map(s => s.trim()).filter(Boolean);
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors(corsOptions));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeBody);
app.use(rateLimit);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/metrics', metricsRouteHandler);

app.use('/api/auth', authRoutes);
app.use('/api/billing', billingPublicRoutes);
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return authenticate(req, res, next);
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

httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`, {
    environment: process.env.NODE_ENV,
    frontendDist: fs.existsSync(frontendDist) ? frontendDist : 'none',
  });
});

export default app;
