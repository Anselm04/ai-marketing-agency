const PUBLIC_SERVER_MESSAGES = {
  ai_cost_pricing_not_configured: 'AI cost protection is not fully configured, so this request was blocked.',
  ai_provider_unavailable: 'The AI provider is temporarily unavailable.',
  ai_model_unavailable: 'The requested AI model is not currently available.',
  ai_fallback_exhausted: 'The configured AI providers could not complete this request.',
  durable_queue_required: 'Durable background processing is temporarily unavailable.',
  queue_backend_unavailable: 'Durable background processing is temporarily unavailable.',
  rate_limit_store_unavailable: 'Request protection is temporarily unavailable. Please try again later.',
};

export function errorHandler(err, req, res, next) {
  const statusCode = Number(err.statusCode || err.status) || 500;
  const isServerError = statusCode >= 500;
  const internalMessage = err.message || 'Internal server error';
  const publicServerMessage = PUBLIC_SERVER_MESSAGES[err.code] || null;
  const message = isServerError
    ? (err.publicMessage || publicServerMessage || (statusCode === 503 ? 'Service temporarily unavailable' : 'Internal server error'))
    : internalMessage;
  const exposeDetails = !isServerError;
  const exposeServerCode = Boolean(publicServerMessage || err.publicCode);

  console.error('Error:', err);

  res.status(statusCode).json({
    error: message,
    ...((exposeDetails && err.code) || exposeServerCode ? { code: err.publicCode || err.code } : {}),
    ...(exposeDetails && err.resource ? { resource: err.resource } : {}),
    ...(exposeDetails && err.plan ? { plan: err.plan } : {}),
    ...(exposeDetails && err.quota ? { quota: err.quota } : {}),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export { PUBLIC_SERVER_MESSAGES };
