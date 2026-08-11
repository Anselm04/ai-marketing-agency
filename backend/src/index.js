import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';

dotenv.config();

import { logger } from './utils/logger.js';
import store from './utils/store.js';

import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import campaignRoutes from './routes/campaigns.js';
import analyticsRoutes from './routes/analytics.js';
import contentRoutes from './routes/content.js';
import crmRoutes from './routes/crm.js';
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
import { handleWebhookEvent } from './services/stripeService.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

const whitelist = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173').split(',').map(s => s.trim());
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

app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(morgan('combined'));

// Stripe webhook endpoint MUST use raw body — register BEFORE express.json()
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  try {
    const event = await handleWebhookEvent(req.body, signature);
    if (event.fallback) {
      logger.info('Stripe webhook fallback mode');
      return res.json({ received: true, fallback: true });
    }
    await store.createWebhookEvent({
      type: event.type,
      stripeEventId: event.id,
      data: event.data,
      processed: false,
    });
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { productId, userId } = session.metadata || {};
      if (productId && userId) {
        const product = await store.getProductById(productId);
        if (product) {
          await store.createPurchase({
            userId,
            productId,
            productName: product.name,
            price: product.price,
            currency: product.currency || 'NZD',
            billingType: product.billingType,
            billingInterval: product.billingInterval,
            stripePaymentIntentId: session.payment_intent,
            stripeSubscriptionId: session.subscription,
            stripeSessionId: session.id,
            status: 'active',
            purchasedAt: new Date().toISOString(),
          });
        }
      }
    }
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const purchases = await store.getPurchases();
      const purchase = purchases.find(p => p.stripeSubscriptionId === invoice.subscription);
      if (purchase) {
        await store.updatePurchase(purchase.id, { status: 'payment_failed', lastFailureAt: new Date().toISOString() });
      }
    }
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const purchases = await store.getPurchases();
      const purchase = purchases.find(p => p.stripeSubscriptionId === subscription.id);
      if (purchase) {
        await store.updatePurchase(purchase.id, { status: 'expired', expiredAt: new Date().toISOString() });
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook error', { error: err.message });
    res.status(400).json({ error: 'Webhook signature verification failed' });
  }
});

// Now apply JSON parsing for all other routes
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

// Public routes (no authentication required)
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes); // catalog endpoints are public; marketing endpoints require auth
app.use('/api/legal', legalRoutes); // terms-versions are public; document generation requires auth

// Protected routes (authentication required)
app.use(authenticate);
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
app.use('/api/trends', trendsRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/affiliate', affiliateRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, { environment: process.env.NODE_ENV });
});

export default app;
