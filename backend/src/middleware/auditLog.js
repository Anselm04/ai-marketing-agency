import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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

const SENSITIVE_PATHS = ['/api/auth', '/api/billing', '/api/connectors', '/api/settings'];
const DATA_MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function privacyHash(value) {
  if (!value) return null;
  const salt = process.env.AUDIT_HASH_SALT || process.env.JWT_SECRET || 'development-audit-salt';
  return crypto.createHmac('sha256', salt).update(String(value)).digest('hex').slice(0, 24);
}

function bodyShape(body) {
  if (!body || typeof body !== 'object') return [];
  return Object.keys(body).slice(0, 50);
}

export function auditLog(req, res, next) {
  const isSensitive = SENSITIVE_PATHS.some(p => req.path.startsWith(p));
  const isMutation = DATA_MUTATION_METHODS.includes(req.method);

  if (isSensitive || isMutation) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ipHash: privacyHash(req.ip),
      userId: req.user?.id || null,
      bodyKeys: isSensitive ? ['[REDACTED]'] : bodyShape(req.body),
      queryKeys: Object.keys(req.query || {}).slice(0, 50),
    };

    auditLogger.info('audit', logEntry);
  }

  next();
}
