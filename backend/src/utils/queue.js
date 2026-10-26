/**
 * BullMQ Job Queue Service.
 * Production background work requires durable Redis-backed queues. In-memory
 * processing is allowed only outside production so a restart cannot silently
 * lose paid customer work after an API reports that it was queued.
 */

import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from './logger.js';

let redisConnection = null;
const queues = new Map();
const workers = new Map();
const inMemoryFallback = new Map();
let fallbackEnabled = false;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const REDIS_URL = process.env.REDIS_URL || (IS_PRODUCTION ? null : 'redis://localhost:6379');
const USE_REDIS_QUEUE = process.env.NODE_ENV === 'test' ? false : process.env.USE_REDIS_QUEUE !== 'false';
const MEMORY_FALLBACK_ALLOWED = !IS_PRODUCTION && process.env.QUEUE_MEMORY_FALLBACK !== 'false';
const JOB_ATTEMPTS = parseInt(process.env.JOB_ATTEMPTS, 10) || 3;
const JOB_BACKOFF_MS = parseInt(process.env.JOB_BACKOFF_MS, 10) || 5000;

function queueUnavailable(message, cause = null) {
  const error = new Error(message);
  error.code = 'durable_queue_unavailable';
  error.statusCode = 503;
  if (cause) error.cause = cause;
  return error;
}

function getRedisConnection() {
  if (!USE_REDIS_QUEUE) {
    if (IS_PRODUCTION) throw queueUnavailable('Production durable queues cannot be disabled. Configure Redis and enable the Redis queue.');
    return null;
  }
  if (!REDIS_URL) {
    if (IS_PRODUCTION) throw queueUnavailable('REDIS_URL is required for durable production background jobs.');
    return null;
  }
  if (redisConnection) return redisConnection;

  try {
    redisConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          if (!IS_PRODUCTION) fallbackEnabled = true;
          return null;
        }
        return Math.min(times * 1000, 3000);
      },
    });
    redisConnection.on('error', (err) => {
      if (!IS_PRODUCTION) fallbackEnabled = true;
      logger.error('Redis queue connection error', { error: err.message, production: IS_PRODUCTION });
    });
    return redisConnection;
  } catch (error) {
    if (IS_PRODUCTION) throw queueUnavailable('Unable to create the production Redis queue connection.', error);
    fallbackEnabled = true;
    return null;
  }
}

export async function checkQueueReadiness() {
  const configured = Boolean(USE_REDIS_QUEUE && REDIS_URL);
  if (!configured) {
    return { configured: false, reachable: false, durable: false };
  }

  try {
    const redis = getRedisConnection();
    if (!redis) return { configured: false, reachable: false, durable: false };
    if (redis.status === 'wait') await redis.connect();
    const pong = await redis.ping();
    return {
      configured: true,
      reachable: pong === 'PONG',
      durable: true,
    };
  } catch (error) {
    logger.error('Durable queue readiness check failed', { code: error.code || 'redis_unavailable' });
    return { configured: true, reachable: false, durable: true };
  }
}

function memoryQueue(name) {
  if (!MEMORY_FALLBACK_ALLOWED) {
    throw queueUnavailable(`Durable queue '${name}' is unavailable. Production work was not queued in memory.`);
  }

  return {
    async add(jobName, data, opts = {}) {
      const job = {
        id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        name: jobName,
        data,
        opts,
        attempts: 0,
        maxAttempts: opts.attempts || JOB_ATTEMPTS,
        status: 'pending',
        createdAt: new Date().toISOString(),
        durable: false,
      };
      if (!inMemoryFallback.has(name)) inMemoryFallback.set(name, []);
      inMemoryFallback.get(name).push(job);
      logger.warn(`Development in-memory job added to '${name}'`, { jobName });
      setTimeout(() => processMemoryJob(name, job), 100);
      return job;
    },
    async getJobCounts() {
      const jobs = inMemoryFallback.get(name) || [];
      return {
        waiting: jobs.filter((job) => job.status === 'pending').length,
        active: jobs.filter((job) => job.status === 'active').length,
        completed: jobs.filter((job) => job.status === 'completed').length,
        failed: jobs.filter((job) => job.status === 'failed').length,
        durable: false,
      };
    },
    async getJobs() { return inMemoryFallback.get(name) || []; },
    async clean() { inMemoryFallback.set(name, []); },
    async close() { inMemoryFallback.delete(name); },
  };
}

export async function getQueue(name) {
  if (queues.has(name)) return queues.get(name);

  let redis = null;
  try {
    redis = getRedisConnection();
    if (redis && !fallbackEnabled) {
      if (redis.status === 'wait') await redis.connect();
      await redis.ping();
      const queue = new Queue(name, {
        connection: redis,
        defaultJobOptions: {
          attempts: JOB_ATTEMPTS,
          backoff: { type: 'exponential', delay: JOB_BACKOFF_MS },
          removeOnComplete: { age: 86400, count: 100 },
          removeOnFail: { age: 604800, count: 50 },
        },
      });
      queues.set(name, queue);
      logger.info(`BullMQ queue '${name}' initialized with durable Redis`);
      return queue;
    }
  } catch (error) {
    if (IS_PRODUCTION) throw queueUnavailable(`Durable production queue '${name}' is unavailable.`, error);
    fallbackEnabled = true;
    logger.warn(`Redis queue '${name}' unavailable; development memory fallback enabled`, { error: error.message });
  }

  const queue = memoryQueue(name);
  queues.set(name, queue);
  return queue;
}

async function processMemoryJob(queueName, job) {
  const processor = workers.get(queueName);
  if (!processor) return;

  job.status = 'active';
  try {
    await processor(job);
    job.status = 'completed';
    job.finishedAt = new Date().toISOString();
  } catch (error) {
    job.attempts += 1;
    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      job.failedReason = error.message;
      logger.error(`Development in-memory job failed: ${queueName}/${job.name}`, { error: error.message });
    } else {
      job.status = 'pending';
      const delay = (2 ** job.attempts) * JOB_BACKOFF_MS;
      setTimeout(() => processMemoryJob(queueName, job), delay);
    }
  }
}

export function registerWorker(queueName, processor, opts = {}) {
  let redis = null;
  try {
    redis = getRedisConnection();
  } catch (error) {
    if (IS_PRODUCTION) throw error;
  }
  workers.set(queueName, processor);

  if (redis && !fallbackEnabled) {
    try {
      const worker = new Worker(queueName, processor, {
        connection: redis,
        concurrency: opts.concurrency || 5,
        autorun: true,
      });
      worker.on('completed', (job) => {
        logger.info(`Job completed: ${queueName}/${job.id}`, { duration: job.finishedOn - job.processedOn });
      });
      worker.on('failed', (job, err) => {
        logger.error(`Job failed: ${queueName}/${job?.id}`, { error: err.message, attempts: job?.attemptsMade });
      });
      worker.on('error', (error) => {
        logger.error(`Worker error: ${queueName}`, { error: error.message });
      });
      logger.info(`BullMQ worker registered for '${queueName}'`);
      return worker;
    } catch (error) {
      if (IS_PRODUCTION) throw queueUnavailable(`Unable to create durable production worker '${queueName}'.`, error);
      fallbackEnabled = true;
      logger.warn(`Worker '${queueName}' using development memory fallback`, { error: error.message });
    }
  }

  if (!MEMORY_FALLBACK_ALLOWED) {
    throw queueUnavailable(`Durable production worker '${queueName}' is unavailable.`);
  }
  logger.warn(`Development in-memory worker registered for '${queueName}'`);
  return null;
}

export async function addJob(queueName, jobName, data, opts = {}) {
  const queue = await getQueue(queueName);
  return queue.add(jobName, data, opts);
}

export async function getQueueStatus(queueName) {
  const queue = await getQueue(queueName);
  return queue.getJobCounts();
}

export async function closeAllQueues() {
  for (const [name, queue] of queues) {
    try {
      await queue.close();
      logger.info(`Queue '${name}' closed`);
    } catch (error) {
      logger.warn(`Error closing queue '${name}'`, { error: error.message });
    }
  }
  queues.clear();
  if (redisConnection) {
    try {
      await redisConnection.quit();
    } catch (error) {
      logger.warn('Error closing Redis', { error: error.message });
    }
    redisConnection = null;
  }
  workers.clear();
  inMemoryFallback.clear();
}

export function queueDurabilityStatus() {
  return {
    production: IS_PRODUCTION,
    redisConfigured: Boolean(REDIS_URL && USE_REDIS_QUEUE),
    memoryFallbackAllowed: MEMORY_FALLBACK_ALLOWED,
    fallbackEnabled,
  };
}

export const QueueNames = {
  AI_GENERATION: 'ai-generation',
  EMAIL_SEND: 'email-send',
  SOCIAL_PUBLISH: 'social-publish',
  CAMPAIGN_EXECUTION: 'campaign-execution',
  CONNECTOR_SYNC: 'connector-sync',
  ANALYTICS_SYNC: 'analytics-sync',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  NOTIFICATION: 'notification',
  EXPORT: 'export',
  IMPORT: 'import',
  BACKUP: 'backup',
  CLEANUP: 'cleanup',
};

export default { checkQueueReadiness, getQueue, registerWorker, addJob, getQueueStatus, closeAllQueues, queueDurabilityStatus, QueueNames };
