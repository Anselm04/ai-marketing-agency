import winston from 'winston';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FORMAT = process.env.LOG_FORMAT || 'json';

const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: 'ai-marketing-agency' },
  transports: [
    new winston.transports.Console({
      format: LOG_FORMAT === 'json'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
    }),
  ],
});

export { logger };

export function logAIRequest(provider, model, operation, duration, tokens, cost, error = null, errObj = null) {
  logger.info('AI request completed', {
    provider,
    model,
    operation,
    duration_ms: duration,
    tokens,
    cost_usd: cost,
    error: error ? String(error) : undefined,
  });
}

export function logConnectorRequest(provider, operation, duration, error = null) {
  logger.info('Connector request completed', {
    provider,
    operation,
    duration_ms: duration,
    error: error ? String(error) : undefined,
  });
}
