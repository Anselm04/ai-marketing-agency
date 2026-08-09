import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const REQUIRED = ['JWT_SECRET'];
const RECOMMENDED = [
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SENDGRID_API_KEY',
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TIKTOK_ACCESS_TOKEN',
  'INSTAGRAM_ACCESS_TOKEN',
  'YOUTUBE_API_KEY',
  'LINKEDIN_ACCESS_TOKEN',
  'FACEBOOK_ACCESS_TOKEN',
  'CORS_ORIGIN',
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
