import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const REQUIRED = ['JWT_SECRET'];
const RECOMMENDED = [
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'SENDGRID_API_KEY',
  'SMTP_HOST',
  'FROM_EMAIL',
  'TWITTER_CLIENT_ID',
  'TWITTER_CLIENT_SECRET',
  'META_APP_ID',
  'META_APP_SECRET',
  'CORS_ORIGIN',
  'API_URL',
];

export function validateEnv() {
  const missing = REQUIRED.filter(key => !process.env[key]);
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const empty = RECOMMENDED.filter(key => !process.env[key]);
  if (empty.length > 0) {
    logger.warn(`Missing recommended environment variables: ${empty.join(', ')}`);
  }

  logger.info('Environment validation passed');
}
