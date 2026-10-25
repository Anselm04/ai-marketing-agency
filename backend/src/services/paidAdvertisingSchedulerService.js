import store from '../utils/store.js';
import { logger } from '../utils/logger.js';
import { providerManagedBillingAvailable } from './paidAdvertisingService.js';
import { reconcileManagedPaidAdBudget } from './paidAdvertisingOrchestratorService.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;

export function isPaidAdReconciliationCandidate(item) {
  return Boolean(
    item
    && item.kind === 'paid_ad_budget'
    && item.ownerId
    && item.providerCampaignId
    && item.enabled === true
    && ['active', 'provider_pause_failed', 'ready_for_provider_launch'].includes(item.status)
    && providerManagedBillingAvailable(item.provider),
  );
}

class PaidAdvertisingSchedulerService {
  constructor() {
    this.timer = null;
    this.running = false;
  }

  intervalMs() {
    const configured = Number(process.env.PAID_AD_RECONCILE_INTERVAL_MS || DEFAULT_INTERVAL_MS);
    return Number.isFinite(configured) ? Math.max(MIN_INTERVAL_MS, configured) : DEFAULT_INTERVAL_MS;
  }

  async runOnce() {
    if (this.running) return { skipped: true, reason: 'already_running' };
    this.running = true;
    try {
      const records = await store.getContent();
      const budgets = records.filter(isPaidAdReconciliationCandidate);
      const results = [];
      for (const budget of budgets) {
        try {
          const reconciled = await reconcileManagedPaidAdBudget(budget.ownerId, budget.id);
          results.push({ id: budget.id, status: reconciled?.status || 'unknown' });
        } catch (error) {
          logger.error('Paid advertising reconciliation failed', {
            budgetId: budget.id,
            provider: budget.provider,
            code: error.code || 'paid_ads_reconciliation_failed',
          });
          results.push({ id: budget.id, error: error.code || 'paid_ads_reconciliation_failed' });
        }
      }
      return { skipped: false, checked: budgets.length, results };
    } finally {
      this.running = false;
    }
  }

  start() {
    if (this.timer) return;
    const interval = this.intervalMs();
    this.timer = setInterval(() => {
      this.runOnce().catch((error) => {
        logger.error('Paid advertising reconciliation scheduler failed', { error: error.message });
      });
    }, interval);
    this.timer.unref?.();
    logger.info('Paid advertising reconciliation scheduler started', { intervalMs: interval });
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    logger.info('Paid advertising reconciliation scheduler stopped');
  }
}

export default new PaidAdvertisingSchedulerService();
