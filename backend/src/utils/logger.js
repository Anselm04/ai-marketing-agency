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
