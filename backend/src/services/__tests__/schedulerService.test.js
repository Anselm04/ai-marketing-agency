import { beforeEach, describe, expect, test, jest } from '@jest/globals';

const records = [];
const cronJobs = new Map();
const createContent = jest.fn(async (value) => {
  const row = { id: `rec-${records.length + 1}`, ...value };
  records.push(row);
  return row;
});
const getContent = jest.fn(async () => [...records]);
const getContentByOwner = jest.fn(async (ownerId) => records.filter((item) => item.owner === ownerId || item.ownerId === ownerId));
const updateContent = jest.fn(async (id, patch) => {
  const row = records.find((item) => item.id === id);
  Object.assign(row, patch);
  return { ...row };
});
const executeTask = jest.fn(async () => ({ id: 'task-1', status: 'completed' }));

jest.unstable_mockModule('../../utils/store.js', () => ({
  default: { createContent, getContent, getContentByOwner, updateContent },
}));
jest.unstable_mockModule('../agentOrchestrator.js', () => ({
  default: { executeTask },
}));
jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.unstable_mockModule('node-cron', () => ({
  default: {
    validate: (expression) => expression === '0 * * * *',
    schedule: (expression, handler) => {
      const job = { expression, handler, stop: jest.fn() };
      cronJobs.set(`${expression}:${cronJobs.size}`, job);
      return job;
    },
  },
}));

const { default: schedulerService } = await import('../schedulerService.js');

beforeEach(() => {
  schedulerService.stop();
  records.splice(0, records.length);
  cronJobs.clear();
  jest.clearAllMocks();
});

describe('durable admin scheduler', () => {
  test('persists an owner-scoped job instead of keeping it only in memory', async () => {
    const job = await schedulerService.scheduleJob({
      ownerId: 'admin-a',
      id: 'hourly-report',
      cronExpression: '0 * * * *',
      agentId: 'performance-optimizer',
      task: 'Review account performance',
      context: { campaignId: 'campaign-1' },
    });

    expect(job).toMatchObject({ id: 'hourly-report', enabled: true });
    expect(records[0]).toMatchObject({ kind: 'admin_scheduled_agent_job', ownerId: 'admin-a', scheduleId: 'hourly-report' });
  });

  test('lists only jobs owned by the current admin', async () => {
    await schedulerService.scheduleJob({ ownerId: 'admin-a', id: 'a', cronExpression: '0 * * * *', agentId: 'content', task: 'A' });
    await schedulerService.scheduleJob({ ownerId: 'admin-b', id: 'b', cronExpression: '0 * * * *', agentId: 'content', task: 'B' });
    await expect(schedulerService.listJobs('admin-a')).resolves.toEqual([expect.objectContaining({ id: 'a' })]);
  });

  test('rehydrates enabled durable jobs after restart', async () => {
    records.push({
      id: 'rec-existing', kind: 'admin_scheduled_agent_job', owner: 'admin-a', ownerId: 'admin-a',
      scheduleId: 'existing', cronExpression: '0 * * * *', agentId: 'content', task: 'Run', enabled: true,
    });
    await schedulerService.start();
    expect(cronJobs.size).toBe(1);
  });

  test('explicitly blocks unsafe legacy global routines', async () => {
    await expect(schedulerService.runHourlyTasks()).rejects.toMatchObject({ code: 'legacy_global_scheduler_disabled', statusCode: 409 });
    await expect(schedulerService.runCampaignOptimizations()).rejects.toMatchObject({ code: 'legacy_global_scheduler_disabled', statusCode: 409 });
  });
});
