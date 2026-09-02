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

export function logAIRequest(provider, model, operation, durationMs, tokens, cost, status = 'ok', err = null) {
  const payload = { provider, model, operation, durationMs, tokens, cost, status };
  if (err) logger.error('ai_request', { ...payload, error: err?.message || String(err) });
  else logger.info('ai_request', payload);
}

export function logConnectorRequest(connector, operation, durationMs, status = 'ok', err = null) {
  const payload = { connector, operation, durationMs, status };
  if (err) logger.error('connector_request', { ...payload, error: err?.message || String(err) });
  else logger.info('connector_request', payload);
}

export { logger };
