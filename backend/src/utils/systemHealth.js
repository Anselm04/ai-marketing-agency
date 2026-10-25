import { openaiStatus } from '../services/openaiService.js';
import { emailTransportConfigured } from '../services/emailService.js';
import { costControlStatus } from '../services/costControlStatus.js';
import { logger } from './logger.js';

function publicAiStatus(status = {}) {
  return {
    configured: status.openaiConfigured === true,
    provider: status.provider || null,
    model: status.model || null,
    status: status.openaiConfigured === true ? 'configured' : 'not_configured',
  };
}

export async function systemHealth(store, production = process.env.NODE_ENV === 'production') {
  const database = store.isPostgres?.() ? 'postgres' : 'local';
  const rawAi = openaiStatus();
  const ai = publicAiStatus(rawAi);
  const billing = {
    stripeApiConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeWebhookVerificationConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  };
  const readiness = {
    database: false,
    aiConfigured: ai.configured,
    emailConfigured: emailTransportConfigured(),
    billingConfigured: billing.stripeApiConfigured && billing.stripeWebhookVerificationConfigured,
  };
  try {
    await store.connectDB();
    if (database === 'postgres') await store.checkReadiness();
    readiness.database = true;
  } catch (error) {
    logger.error('Database readiness check failed', { error: error.message });
  }
  const ready = readiness.database && (!production || (
    database === 'postgres' && readiness.aiConfigured && readiness.emailConfigured && readiness.billingConfigured
  ));
  return {
    status: ready ? 'ok' : 'degraded',
    service: 'trillionai-marketing',
    timestamp: new Date().toISOString(),
    database: readiness.database ? database : 'unavailable',
    persistence: store.getPersistenceInfo?.() || { mode: database === 'postgres' ? 'supabase-postgres' : 'local-json' },
    readiness,
    ai,
    billing,
    costControls: costControlStatus(),
  };
}

export function mountHealthRoutes(app, store) {
  app.get('/live', (_req, res) => res.json({ status: 'alive', timestamp: new Date().toISOString() }));
  // Share one probe across public health URLs and concurrent callers.
  let cachedHealth;
  let checkedAt = 0;
  let pending;
  const readHealth = () => {
    if (cachedHealth && Date.now() - checkedAt < 5000) return Promise.resolve(cachedHealth);
    if (!pending) {
      pending = systemHealth(store).then((health) => {
        cachedHealth = health;
        checkedAt = Date.now();
        return health;
      }).finally(() => { pending = undefined; });
    }
    return pending;
  };
  for (const path of ['/health', '/api/health', '/ready']) {
    app.get(path, async (_req, res, next) => {
      try {
        const health = await readHealth();
        const ready = health.status === 'ok';
        res.status(ready ? 200 : 503).json({
          ...health,
          status: path === '/ready' ? (ready ? 'ready' : 'not_ready') : health.status,
        });
      } catch (error) {
        next(error);
      }
    });
  }
}

export { publicAiStatus };
