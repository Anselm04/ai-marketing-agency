import store from '../utils/store.js';
import { getUserPlanContext } from './planQuotaService.js';
import { usageSummary } from './usageMeteringService.js';

function remaining(limit, used) {
  if (limit === Infinity) return Infinity;
  return Math.max(0, Number(limit || 0) - Number(used || 0));
}

export async function getCustomerUsageSnapshot(userId, now = new Date()) {
  const context = await getUserPlanContext(userId);
  const [measured, campaigns, org] = await Promise.all([
    usageSummary(userId, now),
    store.getCampaignsByOwner(userId),
    store.getOrganizationByUserId(userId),
  ]);

  const activeCampaigns = campaigns.filter(
    (campaign) => !['completed', 'archived', 'cancelled', 'canceled'].includes(campaign.status),
  ).length;
  const teamSeatsUsed = Array.isArray(org?.members) ? org.members.length : 1;

  return {
    plan: context.plan,
    unlimited: context.unlimited,
    measuredAt: measured.measuredAt,
    usage: {
      aiTokensMonth: measured.aiTokensMonth,
      socialPostsDay: measured.socialPostsDay,
      activeCampaigns,
      teamSeatsUsed,
    },
    limits: {
      monthlyAiTokens: context.limits.monthlyAiTokens,
      postsPerDay: context.limits.postsPerDay,
      campaigns: context.limits.campaigns,
      teamSeats: context.limits.teamSeats,
      agents: context.limits.agents,
    },
    remaining: {
      monthlyAiTokens: remaining(context.limits.monthlyAiTokens, measured.aiTokensMonth),
      postsToday: remaining(context.limits.postsPerDay, measured.socialPostsDay),
      campaigns: remaining(context.limits.campaigns, activeCampaigns),
      teamSeats: remaining(context.limits.teamSeats, teamSeatsUsed),
    },
  };
}

export default getCustomerUsageSnapshot;
