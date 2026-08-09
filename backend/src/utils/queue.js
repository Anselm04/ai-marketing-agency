/**
 * BullMQ Job Queue Service
 * Provides Redis-backed job queues for async processing.
 * Gracefully degrades to in-memory queue if Redis is unavailable.
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from './logger.js';

let redisConnection = null;
let queues = new Map();
let workers = new Map();
let inMemoryFallback = new Map();
let fallbackEnabled = false;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const USE_REDIS_QUEUE = process.env.USE_REDIS_QUEUE !== 'false';
const JOB_ATTEMPTS = parseInt(process.env.JOB_ATTEMPTS, 10) || 3;
const JOB_BACKOFF_MS = parseInt(process.env.JOB_BACKOFF_MS, 10) || 5000;

/**
 * Initialize Redis connection for BullMQ
 */
function getRedisConnection() {
  if (!redisConnection && USE_REDIS_QUEUE) {
    try {
      redisConnection = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn(`Redis connection failed after ${times} attempts, switching to in-memory fallback`);
            fallbackEnabled = true;
            return null;
          }
          return Math.min(times * 1000, 3000);
        },
      });
      redisConnection.on('error', (err) => {
        logger.warn('Redis connection error, enabling in-memory fallback', { error: err.message });
        fallbackEnabled = true;
      });
    } catch (err) {
      logger.warn('Failed to create Redis connection, using in-memory fallback', { error: err.message });
      fallbackEnabled = true;
    }
  }
  return redisConnection;
}

/**
 * Get or create a BullMQ queue.
 * Falls back to in-memory array queue if Redis is unavailable.
 */
export async function getQueue(name) {
  if (queues.has(name)) {
    return queues.get(name);
  }

  const redis = getRedisConnection();

  if (redis && !fallbackEnabled) {
    try {
      await redis.connect().catch(() => {});
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
      logger.info(`BullMQ queue '${name}' initialized with Redis`);
      return queue;
    } catch (err) {
      logger.warn(`Failed to initialize BullMQ queue '${name}', falling back to memory`, { error: err.message });
      fallbackEnabled = true;
    }
  }

  // In-memory fallback queue
  const memoryQueue = {
    async add(jobName, data, opts = {}) {
      const job = {
        id: `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: jobName,
        data,
        opts,
        attempts: 0,
        maxAttempts: opts.attempts || JOB_ATTEMPTS,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      if (!inMemoryFallback.has(name)) {
        inMemoryFallback.set(name, []);
      }
      inMemoryFallback.get(name).push(job);
      logger.info(`In-memory job added to '${name}': ${jobName}`);
      // Auto-process in-memory jobs
      setTimeout(() => processMemoryJob(name, job), 100);
      return job;
    },
    async getJobCounts() {
      const jobs = inMemoryFallback.get(name) || [];
      return {
        waiting: jobs.filter((j) => j.status === 'pending').length,
        active: jobs.filter((j) => j.status === 'active').length,
        completed: jobs.filter((j) => j.status === 'completed').length,
        failed: jobs.filter((j) => j.status === 'failed').length,
      };
    },
    async getJobs() {
      return inMemoryFallback.get(name) || [];
    },
    async clean() {
      inMemoryFallback.set(name, []);
    },
    async close() {
      inMemoryFallback.delete(name);
    },
  };
  queues.set(name, memoryQueue);
  logger.info(`In-memory queue '${name}' initialized`);
  return memoryQueue;
}

/**
 * Process an in-memory job using the registered worker processor
 */
async function processMemoryJob(queueName, job) {
  const processor = workers.get(queueName);
  if (!processor) return;

  job.status = 'active';
  try {
    await processor(job);
    job.status = 'completed';
    job.finishedAt = new Date().toISOString();
    logger.info(`In-memory job completed: ${queueName}/${job.name}`);
  } catch (err) {
    job.attempts++;
    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      job.failedReason = err.message;
      logger.error(`In-memory job failed: ${queueName}/${job.name}`, { error: err.message });
    } else {
      job.status = 'pending';
      const delay = Math.pow(2, job.attempts) * JOB_BACKOFF_MS;
      setTimeout(() => processMemoryJob(queueName, job), delay);
    }
  }
}

/**
 * Register a worker processor for a queue.
 * Creates a BullMQ Worker if Redis is available, else registers a callback for in-memory processing.
 */
export function registerWorker(queueName, processor, opts = {}) {
  const redis = getRedisConnection();
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
      logger.info(`BullMQ worker registered for '${queueName}'`);
      return worker;
    } catch (err) {
      logger.warn(`Failed to create BullMQ worker for '${queueName}', using in-memory fallback`, { error: err.message });
    }
  }

  // In-memory: already registered callback for processMemoryJob
  logger.info(`In-memory worker registered for '${queueName}'`);
  return null;
}

/**
 * Add a job to a queue (async).
 */
export async function addJob(queueName, jobName, data, opts = {}) {
  const queue = await getQueue(queueName);
  return queue.add(jobName, data, opts);
}

/**
 * Get queue status counts.
 */
export async function getQueueStatus(queueName) {
  const queue = await getQueue(queueName);
  return queue.getJobCounts();
}

/**
 * Graceful shutdown: close all queues and workers.
 */
export async function closeAllQueues() {
  for (const [name, queue] of queues) {
    try {
      await queue.close();
      logger.info(`Queue '${name}' closed`);
    } catch (err) {
      logger.warn(`Error closing queue '${name}'`, { error: err.message });
    }
  }
  queues.clear();
  if (redisConnection) {
    try {
      await redisConnection.quit();
      logger.info('Redis connection closed');
    } catch (err) {
      logger.warn('Error closing Redis', { error: err.message });
    }
  }
  workers.clear();
  inMemoryFallback.clear();
}

/**
 * Standard queue names used across the application.
 */
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

export default { getQueue, registerWorker, addJob, getQueueStatus, closeAllQueues, QueueNames };
