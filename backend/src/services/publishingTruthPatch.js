const MANUAL_ONLY_METHODS = {
  publishNintendo: ['nintendo', 'Nintendo eShop requires manual Partner Portal submission.'],
  publishPlayStation: ['playstation', 'PlayStation Store requires manual PartnerNet submission.'],
  publishXbox: ['xbox', 'Xbox Store requires manual Partner Center submission.'],
  publishG2Review: ['g2', 'G2 reviews require a real end-user review flow and cannot be auto-posted.'],
  publishCapterraReview: ['capterra', 'Capterra reviews require a real end-user review flow and cannot be auto-posted.'],
  publishClutch: ['clutch', 'Clutch reviews require verified customer participation and cannot be auto-posted.'],
  publishWeChat: ['wechat', 'WeChat publishing requires a verified official-account workflow not implemented by this adapter.'],
  publishAppSumo: ['appsumo', 'AppSumo listings require partner approval and manual commercial onboarding.'],
  publishAlibaba: ['alibaba', 'Alibaba listing automation is not implemented; supplier-console submission is required.'],
  publishRakuten: ['rakuten', 'Rakuten listing automation is not implemented; merchant-console submission is required.'],
  publishSamsungGalaxy: ['samsung', 'Samsung Galaxy Store submission requires the Seller Portal workflow.'],
  publishHuaweiAppGallery: ['huawei', 'Huawei AppGallery submission requires AppGallery Connect workflow.'],
  publishAmazonAppstore: ['amazonappstore', 'Amazon Appstore submission requires the Developer Console workflow.'],
  publishYelp: ['yelp', 'Yelp Fusion API does not support posting customer reviews.'],
  publishTripAdvisor: ['tripadvisor', 'TripAdvisor public content APIs do not support posting customer reviews.'],
  publishBBB: ['bbb', 'BBB review/accreditation workflows cannot be auto-posted by this application.'],
  publishQuora: ['quora', 'Quora does not expose an approved general-purpose posting API for this workflow.'],
  publishIndieHackers: ['indiehackers', 'Indie Hackers does not expose an approved general-purpose posting API for this workflow.'],
  publishSpotifyPodcast: ['spotify', 'Spotify podcast publishing requires an approved podcast-host/RSS distribution workflow.'],
  publishApplePodcast: ['apple-podcasts', 'Apple Podcasts publishing requires an approved RSS/feed submission workflow.'],
  publishClubhouse: ['clubhouse', 'Clubhouse does not expose an approved public room-publishing API for this workflow.'],
  publishOnlyFans: ['onlyfans', 'OnlyFans does not expose an approved public posting API for this workflow.'],
};

const LEGACY_AD_METHODS = {
  createGoogleAdsCampaign: ['google-ads', 'Use the managed Google Ads workflow. The legacy campaign adapter is disabled because it cannot enforce TrillionAI billing and hard-stop controls.'],
  createMetaAdsCampaign: ['meta-ads', 'Use the managed Meta Ads workflow. The legacy campaign adapter is disabled because it cannot enforce TrillionAI billing and hard-stop controls.'],
  createLinkedInAdsCampaign: ['linkedin-ads', 'Managed LinkedIn Ads execution is not production-certified.'],
  createTikTokAdsCampaign: ['tiktok-ads', 'Managed TikTok Ads execution is not production-certified.'],
  createTwitterAdsCampaign: ['twitter-ads', 'Managed X/Twitter Ads execution is not production-certified.'],
  createPinterestAdsCampaign: ['pinterest-ads', 'Managed Pinterest Ads execution is not production-certified.'],
  createSnapchatAdsCampaign: ['snapchat-ads', 'Managed Snapchat Ads execution is not production-certified.'],
  createRedditAdsCampaign: ['reddit-ads', 'Managed Reddit Ads execution is not production-certified.'],
  createAmazonAdsCampaign: ['amazon-ads', 'Managed Amazon Ads execution is not production-certified.'],
  createMicrosoftAdsCampaign: ['microsoft-ads', 'Managed Microsoft Ads execution is not production-certified.'],
  createTaboolaCampaign: ['taboola', 'Managed Taboola execution is not production-certified.'],
  createOutbrainCampaign: ['outbrain', 'Managed Outbrain execution is not production-certified.'],
};

export function manualRequiredResult(platform, message) {
  return {
    success: false,
    published: false,
    blocked: true,
    manualRequired: true,
    platform,
    code: 'manual_platform_workflow',
    message,
  };
}

export function unsupportedAutomationResult(platform, message, code = 'provider_workflow_unavailable') {
  return {
    success: false,
    published: false,
    blocked: true,
    manualRequired: false,
    platform,
    code,
    message,
  };
}

function truthfulResult(result, methodName) {
  if (!result || typeof result !== 'object') return result;
  const hasPlaceholderId = [result.postId, result.campaignId, result.publishId]
    .some((value) => String(value || '').toLowerCase() === 'placeholder');
  const isFallback = result.fallback === true;

  if (!hasPlaceholderId && !isFallback) return result;

  return {
    ...result,
    success: false,
    published: false,
    blocked: true,
    manualRequired: result.manualRequired === true,
    code: hasPlaceholderId ? 'placeholder_result_blocked' : (result.code || 'provider_not_configured'),
    message: result.message || result.error || `${methodName} did not complete a real external operation.`,
    postId: hasPlaceholderId ? null : result.postId,
    campaignId: hasPlaceholderId ? null : result.campaignId,
    publishId: hasPlaceholderId ? null : result.publishId,
  };
}

function wrapTruthfulResults(service) {
  const prototype = Object.getPrototypeOf(service);
  for (const method of Object.getOwnPropertyNames(prototype || {})) {
    if (method === 'constructor' || method === 'isAvailable' || method === 'getConnectedPlatforms') continue;
    if (!/^(publish|create)/.test(method) || typeof service[method] !== 'function') continue;
    if (service[method].__truthfulResultWrapper) continue;

    const original = service[method].bind(service);
    const wrapped = async (...args) => truthfulResult(await original(...args), method);
    Object.defineProperty(wrapped, '__truthfulResultWrapper', { value: true });
    service[method] = wrapped;
  }
}

export function applyPublishingTruthPatch(service) {
  if (!service || service.__publishingTruthPatchApplied) return service;

  for (const [method, [platform, message]] of Object.entries(MANUAL_ONLY_METHODS)) {
    if (typeof service[method] !== 'function') continue;
    service[method] = async function blockedManualOnlyPublish() {
      return manualRequiredResult(platform, message);
    };
  }

  for (const [method, [platform, message]] of Object.entries(LEGACY_AD_METHODS)) {
    if (typeof service[method] !== 'function') continue;
    service[method] = async function blockedLegacyAdCampaign() {
      return unsupportedAutomationResult(platform, message, 'managed_paid_ads_required');
    };
  }

  wrapTruthfulResults(service);

  Object.defineProperty(service, '__publishingTruthPatchApplied', {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return service;
}

export { LEGACY_AD_METHODS, MANUAL_ONLY_METHODS };
