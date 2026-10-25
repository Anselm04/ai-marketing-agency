/**
 * Adds per-request OAuth user-token overrides and enforces truthful publishing
 * semantics for platforms that require a manual or unsupported workflow.
 */
import socialMediaService from './socialMediaService.js';
import { applyPublishingTruthPatch } from './publishingTruthPatch.js';

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
