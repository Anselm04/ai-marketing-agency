import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const auditDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(auditDir, 'audit.log') }),
  ],
});

const SENSITIVE_PATHS = ['/api/auth/register', '/api/auth/login', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/billing'];
const DATA_MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function auditLog(req, res, next) {
  const isSensitive = SENSITIVE_PATHS.some(p => req.path.startsWith(p));
  const isMutation = DATA_MUTATION_METHODS.includes(req.method);

  if (isSensitive || isMutation) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id || null,
      // Don't log body for sensitive routes to avoid leaking passwords/tokens
      body: isSensitive ? '[REDACTED]' : req.body,
      query: req.query,
    };

    auditLogger.info('audit', logEntry);
  }

  next();
}
