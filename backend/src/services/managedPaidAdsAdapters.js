// A provider belongs here only when the repository contains the full code path
// for account discovery, campaign creation, spend reconciliation, and provider
// pause/hard-stop enforcement. This is an implementation registry, NOT a live
// production certification switch. Live charging/launch also requires the
// provider to be explicitly present in PAID_AD_LIVE_PROVIDER_ALLOWLIST after
// real-provider certification with production credentials.
const IMPLEMENTED_MANAGED_ADAPTERS = new Set(['meta', 'google']);

export function isManagedPaidAdsAdapterImplemented(provider) {
  return IMPLEMENTED_MANAGED_ADAPTERS.has(String(provider || '').trim().toLowerCase());
}

export function implementedManagedPaidAdsProviders() {
  return [...IMPLEMENTED_MANAGED_ADAPTERS];
}
