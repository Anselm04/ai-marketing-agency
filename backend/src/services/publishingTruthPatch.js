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

export function applyPublishingTruthPatch(service) {
  if (!service || service.__publishingTruthPatchApplied) return service;

  for (const [method, [platform, message]] of Object.entries(MANUAL_ONLY_METHODS)) {
    if (typeof service[method] !== 'function') continue;
    service[method] = async function blockedManualOnlyPublish() {
      return manualRequiredResult(platform, message);
    };
  }

  Object.defineProperty(service, '__publishingTruthPatchApplied', {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return service;
}

export { MANUAL_ONLY_METHODS };
