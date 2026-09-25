import cron from 'node-cron';
import store from '../utils/store.js';
import clippingAutomationService from './clippingAutomationService.js';
import { logger } from '../utils/logger.js';

class ClippingSchedulerService {
  constructor() {
    this.job = null;
    this.inFlight = new Set();
  }

  start() {
    if (this.job || process.env.CLIPPING_AUTOMATION_SCHEDULER_ENABLED === 'false') return;
    const expression = process.env.CLIPPING_AUTOMATION_CRON || '*/5 * * * *';
    this.job = cron.schedule(expression, () => {
      this.runDueCampaigns().catch((error) => {
        logger.error('AI clipping scheduler cycle failed', { error: error.message });
      });
    });
    logger.info('AI clipping scheduler started', { expression });
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
  }

  async runDueCampaigns() {
    const campaigns = (await store.getCampaigns()).filter(
      (campaign) => campaign.kind === 'ai-clipping'
        && campaign.status === 'running'
        && campaign.autonomous?.enabled === true,
    );

    for (const campaign of campaigns) {
      if (this.inFlight.has(campaign.id)) continue;
      this.inFlight.add(campaign.id);
      try {
        const result = await clippingAutomationService.runCampaignCycle(campaign, { batchSize: 1 });
        logger.info('AI clipping automation cycle completed', {
          campaignId: campaign.id,
          rendered: result.cycle.rendered.length,
          published: result.cycle.published.length,
          blocked: result.cycle.blocked.length,
        });
      } catch (error) {
        logger.error('AI clipping automation campaign failed', {
          campaignId: campaign.id,
          error: error.message,
        });
      } finally {
        this.inFlight.delete(campaign.id);
      }
    }
  }
}

export default new ClippingSchedulerService();
