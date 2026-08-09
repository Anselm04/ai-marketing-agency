import logger from '../utils/logger.js';

export function sentryMiddleware(req, res, next) {
  req.__sentry_start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - req.__sentry_start;
    if (res.statusCode >= 500) {
      logger.error('Server error captured', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
    }
  });
  next();
}

export function captureException(err, context = {}) {
  logger.error('Exception captured', {
    error: err.message,
    stack: err.stack,
    ...context,
  });
}
