/**
 * Structured Logger Service
 * Production-grade Winston logger with correlation IDs, request context,
 and configurable log levels.
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FORMAT = process.env.LOG_FORMAT || 'json';
const NODE_ENV = process.env.NODE_ENV || 'development';

const customFormats = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const simpleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, service, requestId, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `[${timestamp}] ${level}${service ? ` [${service}]` : ''}${requestId ? ` [req:${requestId}]` : ''}: ${message} ${metaStr}`;
  })
);

const transports = [
  new winston.transports.Console({
    format: LOG_FORMAT === 'simple' || NODE_ENV === 'development' ? simpleFormat : customFormats,
  }),
];

if (NODE_ENV === 'production' || NODE_ENV === 'staging') {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '..', '..', 'logs', 'error.log'),
      level: 'error',
      format: customFormats,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '..', '..', 'logs', 'combined.log'),
      format: customFormats,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '..', '..', 'logs', 'audit.log'),
      level: 'info',
      format: customFormats,
    })
  );
}

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: {
    service: 'ai-marketing-backend',
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  },
  transports,
  exitOnError: false,
});

/**
 * Create a child logger with request context.
 */
export function createRequestLogger(req) {
  const requestId = req.headers['x-request-id'] || req.id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.id = requestId;
  return logger.child({
    requestId,
    user: req.user?.id || req.user?.email || 'anonymous',
    org: req.user?.organizationId || 'none',
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    method: req.method,
    path: req.path,
  });
}

/**
 * Log an AI operation with cost and latency metrics.
 */
export function logAIRequest(provider, model, operation, durationMs, tokensUsed = null, cost = null, status = 'success', error = null) {
  const meta = {
    type: 'ai',
    provider,
    model,
    operation,
    durationMs,
    tokensUsed,
    cost,
    status,
  };
  if (error) meta.error = error.message || error;
  logger.info(`AI ${operation} ${status}`, meta);
}

/**
 * Log a connector operation.
 */
export function logConnectorRequest(connectorId, operation, durationMs, status = 'success', error = null) {
  const meta = {
    type: 'connector',
    connectorId,
    operation,
    durationMs,
    status,
  };
  if (error) meta.error = error.message || error;
  logger.info(`Connector ${connectorId} ${operation} ${status}`, meta);
}

/**
 * Log an audit event (security-sensitive).
 */
export function logAudit(event, userId, resource, action, details = {}) {
  logger.info(`AUDIT: ${event}`, {
    type: 'audit',
    userId,
    resource,
    action,
    details,
    timestamp: new Date().toISOString(),
  });
}

export default logger;
