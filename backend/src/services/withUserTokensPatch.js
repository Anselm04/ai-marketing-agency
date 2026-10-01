/**
 * Monkey-patch socialMediaService.default with withUserTokens() for per-request
 * OAuth user tokens. Import this once from social routes before publish.
 */
import socialMediaService from './socialMediaService.js';

if (typeof socialMediaService.withUserTokens !== 'function') {
  socialMediaService.withUserTokens = function withUserTokens(overrides = {}) {
    const clone = Object.create(Object.getPrototypeOf(this));
    clone.tokens = { ...this.tokens };
    for (const [k, v] of Object.entries(overrides || {})) {
      if (v) clone.tokens[k] = v;
    }
    return clone;
  };
}

export default socialMediaService;
export { socialMediaService };
