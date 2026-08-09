import cron from 'node-cron';
import agentOrchestrator from './agentOrchestrator.js';

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.active = false;
  }

  start() {
    if (this.active) return;
    this.active = true;

    cron.schedule('0 * * * *', () => this.runHourlyTasks());
    cron.schedule('0 9 * * *', () => this.runDailyTasks());
    cron.schedule('*/15 * * * *', () => this.runCampaignOptimizations());

    console.log('Scheduler service started');
  }

  async runHourlyTasks() {
    console.log('Running hourly scheduled tasks');
    const tasks = [
      { agentId: 'social-media', task: 'Schedule next batch of social posts', context: { batchSize: 10 } },
      { agentId: 'market-research', task: 'Scan trending topics and hashtags', context: { platforms: ['TikTok', 'Instagram', 'Twitter/X'] } },
      { agentId: 'performance-optimizer', task: 'Check active campaign metrics and suggest adjustments', context: {} },
    ];

    for (const t of tasks) {
      try {
        await agentOrchestrator.executeTask(t.agentId, t.task, t.context);
      } catch (err) {
        console.error(`Scheduled task failed for ${t.agentId}:`, err.message);
      }
    }
  }

  async runDailyTasks() {
    console.log('Running daily scheduled tasks');
    const tasks = [
      { agentId: 'seo-aeo', task: 'Generate daily SEO report and keyword recommendations', context: {} },
      { agentId: 'content', task: 'Draft content calendar for next 7 days', context: {} },
      { agentId: 'legal-compliance', task: 'Review published content for compliance', context: {} },
      { agentId: 'agent-oversight', task: 'Review all agent performance and flag issues', context: {} },
      { agentId: 'harmony-director', task: 'Optimize agent workflows and remove overlaps', context: {} },
    ];

    for (const t of tasks) {
      try {
        await agentOrchestrator.executeTask(t.agentId, t.task, t.context);
      } catch (err) {
        console.error(`Daily task failed for ${t.agentId}:`, err.message);
      }
    }
  }

  async runCampaignOptimizations() {
    console.log('Running campaign optimization checks');
    try {
      await agentOrchestrator.executeTask('performance-optimizer', 'A/B test evaluation and budget reallocation', {});
      await agentOrchestrator.executeTask('ad-optimizer', 'Adjust ad bids and audience targeting', {});
    } catch (err) {
      console.error('Campaign optimization failed:', err.message);
    }
  }

  scheduleJob(id, cronExpression, agentId, task, context = {}) {
    if (this.jobs.has(id)) {
      this.jobs.get(id).stop();
    }
    const job = cron.schedule(cronExpression, async () => {
      try {
        await agentOrchestrator.executeTask(agentId, task, context);
      } catch (err) {
        console.error(`Scheduled job ${id} failed:`, err.message);
      }
    });
    this.jobs.set(id, job);
    return { id, cronExpression, agentId, task, scheduled: true };
  }

  cancelJob(id) {
    if (this.jobs.has(id)) {
      this.jobs.get(id).stop();
      this.jobs.delete(id);
      return { cancelled: true };
    }
    return { cancelled: false, error: 'Job not found' };
  }

  listJobs() {
    return Array.from(this.jobs.keys()).map(id => ({ id, active: true }));
  }
}

export default new SchedulerService();
