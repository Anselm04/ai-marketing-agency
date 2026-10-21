import store from '../utils/store.js';
import { getUserPlanContext } from './planQuotaService.js';
import { usageSummary } from './usageMeteringService.js';

function remaining(limit, used) {
  if (limit === Infinity) return Infinity;
  return Math.max(0, Number(limit || 0) - Number(used || 0));
}

export async function getCustomerUsageSnapshot(userId, now = new Date()) {
  const context = await getUserPlanContext(userId);
  const [measured, campaigns] = await Promise.all([
    usageSummary(userId, now),
    store.getCampaignsByOwner(userId),
  ]);

  const activeCampaigns = campaigns.filter(
    (campaign) => !['completed', 'archived', 'cancelled', 'canceled'].includes(campaign.status),
  ).length;

  return {
    plan: context.plan,
    unlimited: context.unlimited,
    measuredAt: measured.measuredAt,
    usage: {
      aiTokensMonth: measured.aiTokensMonth,
      socialPostsDay: measured.socialPostsDay,
      activeCampaigns,
    },
    limits: {
      monthlyAiTokens: context.limits.monthlyAiTokens,
      postsPerDay: context.limits.postsPerDay,
      campaigns: context.limits.campaigns,
      agents: context.limits.agents,
    },
    remaining: {
      monthlyAiTokens: remaining(context.limits.monthlyAiTokens, measured.aiTokensMonth),
      postsToday: remaining(context.limits.postsPerDay, measured.socialPostsDay),
      campaigns: remaining(context.limits.campaigns, activeCampaigns),
    },
  };
}

export default getCustomerUsageSnapshot;
