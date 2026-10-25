import cron from 'node-cron';
import store from '../utils/store.js';
import agentOrchestrator from './agentOrchestrator.js';
import { logger } from '../utils/logger.js';

const KIND = 'admin_scheduled_agent_job';

function schedulerError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function safeString(value, max) {
  return String(value || '').trim().slice(0, max);
}

function publicJob(record = {}) {
  return {
    id: record.scheduleId || record.id,
    recordId: record.id,
    cronExpression: record.cronExpression,
    agentId: record.agentId,
    task: record.task,
    enabled: record.enabled === true,
    active: record.enabled === true,
    lastRunAt: record.lastRunAt || null,
    lastRunStatus: record.lastRunStatus || null,
    lastError: record.lastError || null,
    nextExecutionManagedByCron: record.enabled === true,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.started = false;
  }

  async start() {
    if (this.started) return;
    this.started = true;
    await this.rehydrate().catch((error) => {
      logger.error('Durable scheduler rehydration failed', { error: error.message });
    });
    logger.info('Durable admin scheduler started', {
      restoredJobs: this.jobs.size,
      broadBuiltInAutomationEnabled: false,
    });
  }

  stop() {
    for (const job of this.jobs.values()) job.cron.stop();
    this.jobs.clear();
    this.started = false;
  }

  async records() {
    const all = await store.getContent();
    return all.filter((item) => item.kind === KIND);
  }

  async recordsForOwner(ownerId) {
    const all = await store.getContentByOwner(ownerId);
    return all.filter((item) => item.kind === KIND);
  }

  async rehydrate() {
    const records = await this.records();
    for (const record of records) {
      if (record.enabled !== true) continue;
      try {
        this.mount(record);
      } catch (error) {
        await store.updateContent(record.id, {
          enabled: false,
          lastRunStatus: 'invalid_schedule',
          lastError: error.message,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  mount(record) {
    if (!cron.validate(record.cronExpression)) {
      throw schedulerError('Invalid cron expression.', 'scheduler_cron_invalid');
    }
    const key = String(record.id);
    const existing = this.jobs.get(key);
    if (existing) existing.cron.stop();

    const scheduled = cron.schedule(record.cronExpression, () => {
      this.executeRecord(record.id).catch((error) => {
        logger.error('Scheduled agent job failed', { recordId: record.id, error: error.message });
      });
    });
    this.jobs.set(key, { cron: scheduled, recordId: record.id });
    return record;
  }

  async executeRecord(recordId) {
    const record = (await this.records()).find((item) => String(item.id) === String(recordId));
    if (!record || record.enabled !== true) return null;

    const startedAt = new Date().toISOString();
    await store.updateContent(record.id, {
      lastRunAt: startedAt,
      lastRunStatus: 'running',
      lastError: null,
      updatedAt: startedAt,
    });

    try {
      const taskRecord = await agentOrchestrator.executeTask(record.agentId, record.task, {
        ...(record.context || {}),
        userId: record.ownerId || record.owner,
        scheduledJobId: record.scheduleId,
      });
      const completedAt = new Date().toISOString();
      const updated = await store.updateContent(record.id, {
        lastRunAt: startedAt,
        lastRunStatus: 'completed',
        lastTaskId: taskRecord.id,
        lastCompletedAt: completedAt,
        lastError: null,
        updatedAt: completedAt,
      });
      return publicJob(updated);
    } catch (error) {
      const failedAt = new Date().toISOString();
      await store.updateContent(record.id, {
        lastRunAt: startedAt,
        lastRunStatus: 'failed',
        lastError: safeString(error.message, 2000),
        updatedAt: failedAt,
      });
      throw error;
    }
  }

  async scheduleJob({ ownerId, id, cronExpression, agentId, task, context = {} }) {
    const scheduleId = safeString(id, 120);
    const normalizedAgentId = safeString(agentId, 120);
    const normalizedTask = safeString(task, 4000);
    if (!ownerId) throw schedulerError('Scheduler job owner is required.', 'scheduler_owner_required');
    if (!scheduleId) throw schedulerError('Job id is required.', 'scheduler_job_id_required');
    if (!cron.validate(cronExpression)) throw schedulerError('Invalid cron expression.', 'scheduler_cron_invalid');
    if (!normalizedAgentId) throw schedulerError('Agent id is required.', 'scheduler_agent_required');
    if (!normalizedTask) throw schedulerError('Task is required.', 'scheduler_task_required');

    const owned = await this.recordsForOwner(ownerId);
    const current = owned.find((item) => String(item.scheduleId) === scheduleId);
    const now = new Date().toISOString();
    const payload = {
      kind: KIND,
      owner: ownerId,
      ownerId,
      scheduleId,
      cronExpression: String(cronExpression).trim(),
      agentId: normalizedAgentId,
      task: normalizedTask,
      context: context && typeof context === 'object' && !Array.isArray(context) ? context : {},
      enabled: true,
      updatedAt: now,
    };

    const record = current
      ? await store.updateContent(current.id, payload)
      : await store.createContent({ ...payload, createdAt: now, lastRunAt: null, lastRunStatus: null, lastError: null });
    this.mount(record);
    return publicJob(record);
  }

  async cancelJob(ownerId, scheduleId) {
    const owned = await this.recordsForOwner(ownerId);
    const record = owned.find((item) => String(item.scheduleId) === String(scheduleId));
    if (!record) return { cancelled: false, error: 'Job not found' };

    const mounted = this.jobs.get(String(record.id));
    if (mounted) {
      mounted.cron.stop();
      this.jobs.delete(String(record.id));
    }
    const updated = await store.updateContent(record.id, {
      enabled: false,
      updatedAt: new Date().toISOString(),
    });
    return { cancelled: true, job: publicJob(updated) };
  }

  async listJobs(ownerId) {
    return (await this.recordsForOwner(ownerId)).map(publicJob);
  }

  // Broad global routines from the original prototype are intentionally not
  // auto-scheduled. They lack tenant/customer/provider scope and must not alter
  // campaigns or publish work across accounts. Keep explicit admin-run methods
  // blocked until each task is routed through a scoped production service.
  async runHourlyTasks() {
    throw schedulerError(
      'Legacy broad hourly automation is disabled. Create explicit tenant-scoped scheduler jobs instead.',
      'legacy_global_scheduler_disabled',
      409,
    );
  }

  async runDailyTasks() {
    throw schedulerError(
      'Legacy broad daily automation is disabled. Create explicit tenant-scoped scheduler jobs instead.',
      'legacy_global_scheduler_disabled',
      409,
    );
  }

  async runCampaignOptimizations() {
    throw schedulerError(
      'Legacy global campaign optimization is disabled. Campaign optimization must be scoped to a real customer/campaign/provider.',
      'legacy_global_scheduler_disabled',
      409,
    );
  }
}

export { KIND as SCHEDULED_AGENT_JOB_KIND, publicJob };
export default new SchedulerService();