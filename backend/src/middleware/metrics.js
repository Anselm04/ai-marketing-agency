import { register, Counter, Histogram, Gauge } from 'prom-client';

const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const requestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

const aiRequests = new Counter({
  name: 'ai_requests_total',
  help: 'Total AI requests by provider',
  labelNames: ['provider', 'model', 'status'],
});

const integrationEvents = new Counter({
  name: 'integration_events_total',
  help: 'Total integration events',
  labelNames: ['integration', 'event_type'],
});

const campaignGauge = new Gauge({
  name: 'campaigns_total',
  help: 'Total campaigns created',
});

const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Active users in the last 24h',
});

export function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequests.inc({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
    requestDuration.observe({ method: req.method, route: req.route?.path || req.path }, duration);
  });
  next();
}

export function recordAIRequest(provider, model, status) {
  aiRequests.inc({ provider, model, status });
}

export function recordIntegrationEvent(integration, eventType) {
  integrationEvents.inc({ integration, event_type: eventType });
}

export function setCampaignCount(count) {
  campaignGauge.set(count);
}

export function setActiveUsers(count) {
  activeUsers.set(count);
}

export async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
