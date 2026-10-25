/**
 * Installs runtime truthfulness patches and adds per-request OAuth user-token
 * overrides. These patches preserve the existing service architecture while
 * preventing fallback/placeholder output from being reported as real work.
 */
import socialMediaService from './socialMediaService.js';
import { applyPublishingTruthPatch } from './publishingTruthPatch.js';
import './autoPostingTruthPatch.js';

applyPublishingTruthPatch(socialMediaService);

if (typeof socialMediaService.withUserTokens !== 'function') {
  socialMediaService.withUserTokens = function withUserTokens(overrides = {}) {
    const clone = Object.create(Object.getPrototypeOf(this));
    clone.tokens = { ...this.tokens };
    for (const [k, v] of Object.entries(overrides || {})) {
      if (v) clone.tokens[k] = v;
    }
    applyPublishingTruthPatch(clone);
    return clone;
  };
}

export default socialMediaService;
export { socialMediaService };
