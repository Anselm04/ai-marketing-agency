/**
 * Installs runtime truthfulness and safety patches that must be active before
 * customer routes execute. These patches preserve the existing architecture
 * while preventing fallback/placeholder output and quota bypasses.
 */
import socialMediaService from './socialMediaService.js';
import { applyPublishingTruthPatch } from './publishingTruthPatch.js';
import { installMetaSocialPublishingPatch } from './metaSocialPublishingPatch.js';
import { installAutoPostingTruthPatch } from './autoPostingTruthPatch.js';
import { installCampaignCreationGuard } from './campaignCreationService.js';

// A public/read API or website presence is not proof of an authenticated posting
// capability. The legacy service used hard-coded `true` values for Hacker News
// and Indie Hackers, which made them appear connected. Keep them unavailable
// until a real authenticated publishing adapter is implemented and verified.
socialMediaService.tokens.hackernews = null;
socialMediaService.tokens.indiehackers = null;

installMetaSocialPublishingPatch(socialMediaService);
applyPublishingTruthPatch(socialMediaService);
installAutoPostingTruthPatch();
installCampaignCreationGuard();

if (typeof socialMediaService.withUserTokens !== 'function') {
  socialMediaService.withUserTokens = function withUserTokens(overrides = {}) {
    const clone = Object.create(Object.getPrototypeOf(this));
    clone.tokens = { ...this.tokens, hackernews: null, indiehackers: null };
    for (const [k, v] of Object.entries(overrides || {})) {
      if (v) clone.tokens[k] = v;
    }
    installMetaSocialPublishingPatch(clone);
    applyPublishingTruthPatch(clone);
    return clone;
  };
}

export default socialMediaService;
export { socialMediaService };
