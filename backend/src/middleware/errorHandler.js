export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  const exposeDetails = statusCode < 500;

  console.error('Error:', err);

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : message,
    ...(exposeDetails && err.code ? { code: err.code } : {}),
    ...(exposeDetails && err.resource ? { resource: err.resource } : {}),
    ...(exposeDetails && err.plan ? { plan: err.plan } : {}),
    ...(exposeDetails && err.quota ? { quota: err.quota } : {}),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}
