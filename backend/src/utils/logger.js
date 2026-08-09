import winston from 'winston'

const { combine, timestamp, json, errors, printf } = winston.format

const logFormat = process.env.LOG_FORMAT === 'pretty'
  ? printf(({ level, message, timestamp, ...metadata }) => {
      const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : ''
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${meta}`
    })
  : json()

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'ai-marketing-agency' },
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 14,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 14,
    }),
    new winston.transports.File({
      filename: 'logs/audit.log',
      level: 'info',
      filter: (log) => log.audit === true,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
})

export function createRequestLogger(req) {
  const requestId = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  req.requestId = requestId

  return logger.child({
    requestId,
    userId: req.userId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  })
}

export default logger
