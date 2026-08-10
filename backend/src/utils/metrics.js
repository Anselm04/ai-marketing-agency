/**
 * Prometheus Metrics Service
 * Collects HTTP metrics, AI metrics, connector metrics, and queue metrics.
 * Exposes /metrics endpoint for Prometheus scraping.
 */

import promClient from 'prom-client';
import { logger } from './logger.js';

const METRICS_ENABLED = process.env.METRICS_ENABLED !== 'false';
const METRICS_PORT = parseInt(process.env.METRICS_PORT, 10) || 9090;

// Create a custom registry
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: 'ama_' });

// ------------------------------------------------------------------
// HTTP metrics
// ------------------------------------------------------------------

export const httpRequestsTotal = new promClient.Counter({
  name: 'ama_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'ama_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestSize = new promClient.Histogram({
  name: 'ama_http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

export const httpResponseSize = new promClient.Histogram({
  name: 'ama_http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// ------------------------------------------------------------------
// AI metrics
// ------------------------------------------------------------------

export const aiRequestsTotal = new promClient.Counter({
  name: 'ama_ai_requests_total',
  help: 'Total AI model requests',
  labelNames: ['provider', 'model', 'status'],
  registers: [register],
});

export const aiRequestDuration = new promClient.Histogram({
  name: 'ama_ai_request_duration_seconds',
  help: 'AI request duration in seconds',
  labelNames: ['provider', 'model', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

export const aiTokensUsed = new promClient.Counter({
  name: 'ama_ai_tokens_used_total',
  help: 'Total AI tokens consumed',
  labelNames: ['provider', 'model', 'type'],
  registers: [register],
});

export const aiCost = new promClient.Counter({
  name: 'ama_ai_cost_usd_total',
  help: 'Total AI cost in USD',
  labelNames: ['provider', 'model'],
  registers: [register],
});

// ------------------------------------------------------------------
// Connector metrics
// ------------------------------------------------------------------

export const connectorRequestsTotal = new promClient.Counter({
  name: 'ama_connector_requests_total',
  help: 'Total connector API requests',
  labelNames: ['connector', 'operation', 'status'],
  registers: [register],
});

export const connectorRequestDuration = new promClient.Histogram({
  name: 'ama_connector_request_duration_seconds',
  help: 'Connector request duration in seconds',
  labelNames: ['connector', 'operation'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const connectorActiveConnections = new promClient.Gauge({
  name: 'ama_connector_active_connections',
  help: 'Active connector connections per user',
  labelNames: ['connector', 'org_id'],
  registers: [register],
});

// ------------------------------------------------------------------
// Queue metrics
// ------------------------------------------------------------------

export const queueJobsTotal = new promClient.Counter({
  name: 'ama_queue_jobs_total',
  help: 'Total jobs processed by queue',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const queueJobDuration = new promClient.Histogram({
  name: 'ama_queue_job_duration_seconds',
  help: 'Queue job processing duration',
  labelNames: ['queue', 'job_name'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
  registers: [register],
});

export const queueSize = new promClient.Gauge({
  name: 'ama_queue_size',
  help: 'Current queue size',
  labelNames: ['queue', 'state'],
  registers: [register],
});

// ------------------------------------------------------------------
// Business metrics
// ------------------------------------------------------------------

export const activeUsers = new promClient.Gauge({
  name: 'ama_active_users',
  help: 'Number of active users',
  labelNames: ['org_id'],
  registers: [register],
});

export const cacheHitRatio = new promClient.Gauge({
  name: 'ama_cache_hit_ratio',
  help: 'Cache hit ratio',
  labelNames: ['prefix'],
  registers: [register],
});

export const dbConnections = new promClient.Gauge({
  name: 'ama_db_connections',
  help: 'Active database connections',
  registers: [register],
});

export const websocketConnections = new promClient.Gauge({
  name: 'ama_websocket_connections',
  help: 'Active WebSocket connections',
  labelNames: ['org_id'],
  registers: [register],
});

// ------------------------------------------------------------------
// Express middleware for HTTP metrics
// ------------------------------------------------------------------

export function metricsMiddleware() {
  return (req, res, next) => {
    if (!METRICS_ENABLED) return next();

    const start = Date.now();
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const status = res.statusCode.toString();
      const requestSize = parseInt(req.headers['content-length'] || '0', 10);
      const responseSize = parseInt(res.getHeader('content-length') || '0', 10);

      httpRequestsTotal.inc({ method, route, status_code: status });
      httpRequestDuration.observe({ method, route, status_code: status }, duration);
      httpRequestSize.observe({ method, route }, requestSize);
      httpResponseSize.observe({ method, route }, responseSize);
    });

    next();
  };
}

/**
 * Express route handler for /metrics endpoint.
 */
export function metricsRouteHandler(req, res) {
  if (!METRICS_ENABLED) {
    return res.status(404).json({ error: 'Metrics disabled' });
  }
  res.set('Content-Type', register.contentType);
  register.metrics().then((data) => res.end(data)).catch((err) => {
    logger.error('Metrics collection failed', { error: err.message });
    res.status(500).end('Error collecting metrics');
  });
}

/**
 * Record AI metrics after a request.
 */
export function recordAIRequest(provider, model, operation, durationMs, status = 'success', tokensUsed = null, cost = null) {
  if (!METRICS_ENABLED) return;
  const duration = durationMs / 1000;
  aiRequestsTotal.inc({ provider, model, status });
  aiRequestDuration.observe({ provider, model, operation }, duration);
  if (tokensUsed) aiTokensUsed.inc({ provider, model, type: 'total' }, tokensUsed);
  if (cost) aiCost.inc({ provider, model }, cost);
}

/**
 * Record connector metrics.
 */
export function recordConnectorRequest(connector, operation, durationMs, status = 'success') {
  if (!METRICS_ENABLED) return;
  const duration = durationMs / 1000;
  connectorRequestsTotal.inc({ connector, operation, status });
  connectorRequestDuration.observe({ connector, operation }, duration);
}

/**
 * Record queue metrics.
 */
export function recordQueueJob(queue, jobName, durationMs, status = 'completed') {
  if (!METRICS_ENABLED) return;
  const duration = durationMs / 1000;
  queueJobsTotal.inc({ queue, status });
  queueJobDuration.observe({ queue, job_name: jobName }, duration);
}

export default {
  register,
  metricsMiddleware,
  metricsRouteHandler,
  recordAIRequest,
  recordConnectorRequest,
  recordQueueJob,
  httpRequestsTotal,
  httpRequestDuration,
  aiRequestsTotal,
  aiRequestDuration,
  aiTokensUsed,
  aiCost,
  connectorRequestsTotal,
  connectorRequestDuration,
  connectorActiveConnections,
  queueJobsTotal,
  queueJobDuration,
  queueSize,
  activeUsers,
  cacheHitRatio,
  dbConnections,
  websocketConnections,
};
