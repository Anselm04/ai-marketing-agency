/**
 * Health Check Service
 * Provides /health (deep), /ready (readiness), /live (liveness) endpoints.
 * Checks Redis, MongoDB, AI providers, and connector health.
 */

import { logger } from './logger.js';
import { getStats as cacheStats } from './cache.js';
import { getQueueStatus, QueueNames } from './queue.js';

const checks = new Map();

/**
 * Register a health check function.
 * @param {string} name - Check name
 * @param {Function} fn - Async function returning { status: 'up'|'down', detail?: string }
 * @param {boolean} critical - Whether failure makes the whole system unhealthy
 */
export function registerHealthCheck(name, fn, critical = false) {
  checks.set(name, { fn, critical });
  logger.info(`Health check registered: ${name} (${critical ? 'critical' : 'non-critical'})`);
}

/**
 * Run all health checks and return aggregated status.
 */
export async function runHealthChecks() {
  const results = {};
  let healthy = true;

  for (const [name, { fn, critical }] of checks) {
    try {
      const start = Date.now();
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
      ]);
      results[name] = {
        status: result.status || 'up',
        latency: Date.now() - start,
        detail: result.detail || null,
      };
      if (result.status !== 'up' && critical) {
        healthy = false;
      }
    } catch (err) {
      results[name] = {
        status: 'down',
        error: err.message,
      };
      if (critical) healthy = false;
    }
  }

  return { healthy, checks: results, timestamp: new Date().toISOString() };
}

/**
 * Built-in health checks.
 */

// Cache health check
registerHealthCheck('cache', async () => {
  const stats = await cacheStats();
  if (stats.fallback && stats.backend === 'memory') {
    return { status: 'degraded', detail: 'Running in-memory fallback (Redis unavailable)' };
  }
  return { status: 'up', detail: stats.backend };
}, false);

// AI providers health check (lightweight ping)
registerHealthCheck('ai-providers', async () => {
  const { aiModelRegistry } = await import('../services/aiModelRegistry.js');
  const providers = aiModelRegistry.getAllProviders();
  const available = providers.filter((p) => p.isAvailable()).length;
  const total = providers.length;
  if (available === 0) {
    return { status: 'down', detail: 'No AI providers available' };
  }
  if (available < total) {
    return { status: 'degraded', detail: `${available}/${total} AI providers available` };
  }
  return { status: 'up', detail: `${available}/${total} providers available` };
}, false);

// Queue health check
registerHealthCheck('queue', async () => {
  try {
    const status = await getQueueStatus(QueueNames.AI_GENERATION);
    return { status: 'up', detail: `Queue jobs: ${JSON.stringify(status)}` };
  } catch (err) {
    return { status: 'degraded', detail: err.message };
  }
}, false);

// Database health check (critical)
registerHealthCheck('database', async () => {
  const { store } = await import('../utils/store.js');
  try {
    await store.ping?.();
    return { status: 'up', detail: 'Database responding' };
  } catch (err) {
    return { status: 'down', detail: err.message };
  }
}, true);

// Memory usage check
registerHealthCheck('memory', async () => {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);
  const thresholdMB = 1024; // 1GB
  if (rssMB > thresholdMB) {
    return { status: 'degraded', detail: `Memory usage high: ${rssMB}MB RSS` };
  }
  return { status: 'up', detail: `Heap: ${heapUsedMB}/${heapTotalMB}MB, RSS: ${rssMB}MB` };
}, false);

/**
 * Express middleware mounting health check routes.
 */
export function mountHealthChecks(app) {
  // Liveness probe — always returns 200 if process is running
  app.get('/live', (req, res) => {
    res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
  });

  // Readiness probe — checks if the app can serve traffic
  app.get('/ready', async (req, res) => {
    const result = await runHealthChecks();
    const criticalDown = Object.entries(result.checks).filter(
      ([name, check]) => check.status === 'down' && checks.get(name)?.critical
    );
    const status = criticalDown.length > 0 ? 503 : 200;
    res.status(status).json({
      status: status === 200 ? 'ready' : 'not ready',
      checks: result.checks,
      timestamp: result.timestamp,
    });
  });

  // Deep health check — full system status
  app.get('/health', async (req, res) => {
    const result = await runHealthChecks();
    const statusCode = result.healthy ? 200 : 503;
    res.status(statusCode).json({
      status: result.healthy ? 'healthy' : 'unhealthy',
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      checks: result.checks,
      timestamp: result.timestamp,
    });
  });

  logger.info('Health check routes mounted: /live, /ready, /health');
}

export default { registerHealthCheck, runHealthChecks, mountHealthChecks };
