function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function verifiedMetric(campaign, metric) {
  const provenance = campaign?.performanceProvenance?.[metric];
  return Boolean(
    provenance
    && provenance.kind === 'provider_verified'
    && provenance.provider
    && provenance.observedAt,
  );
}

export function aggregateCampaignPerformance(campaigns = []) {
  let reportedRevenue = 0;
  let reportedSpend = 0;
  let verifiedRevenue = 0;
  let verifiedSpend = 0;
  let verifiedRevenueCampaigns = 0;
  let verifiedSpendCampaigns = 0;

  for (const campaign of campaigns) {
    const revenue = number(campaign?.revenue);
    const spend = number(campaign?.spend);
    reportedRevenue += revenue;
    reportedSpend += spend;

    if (verifiedMetric(campaign, 'revenue')) {
      verifiedRevenue += revenue;
      verifiedRevenueCampaigns += 1;
    }
    if (verifiedMetric(campaign, 'spend')) {
      verifiedSpend += spend;
      verifiedSpendCampaigns += 1;
    }
  }

  const fullyVerifiedCampaigns = campaigns.filter(
    (campaign) => verifiedMetric(campaign, 'revenue') && verifiedMetric(campaign, 'spend'),
  );
  const verifiedPairRevenue = fullyVerifiedCampaigns.reduce((sum, campaign) => sum + number(campaign.revenue), 0);
  const verifiedPairSpend = fullyVerifiedCampaigns.reduce((sum, campaign) => sum + number(campaign.spend), 0);
  const verifiedRoi = verifiedPairSpend > 0
    ? (verifiedPairRevenue - verifiedPairSpend) / verifiedPairSpend
    : null;

  return {
    verified: {
      revenue: verifiedRevenue,
      spend: verifiedSpend,
      roi: verifiedRoi == null ? null : Number(verifiedRoi.toFixed(4)),
      revenueCampaigns: verifiedRevenueCampaigns,
      spendCampaigns: verifiedSpendCampaigns,
      pairedCampaigns: fullyVerifiedCampaigns.length,
    },
    reported: {
      revenue: reportedRevenue,
      spend: reportedSpend,
    },
    provenance: {
      revenue: verifiedRevenueCampaigns > 0 ? 'provider_verified_partial_or_full' : 'unverified_or_manual',
      spend: verifiedSpendCampaigns > 0 ? 'provider_verified_partial_or_full' : 'unverified_or_manual',
      roi: verifiedRoi == null ? 'unavailable_without_verified_revenue_and_spend' : 'provider_verified',
      note: 'Reported campaign values are not treated as measured provider performance unless a provider-verified provenance record is attached.',
    },
  };
}

export function markManualPerformanceInput(existing = {}, updates = {}, now = new Date().toISOString()) {
  const next = { ...(existing || {}) };
  for (const metric of ['revenue', 'spend']) {
    if (Object.prototype.hasOwnProperty.call(updates, metric)) {
      next[metric] = {
        kind: 'manual_user_entry',
        observedAt: now,
      };
    }
  }
  return next;
}
