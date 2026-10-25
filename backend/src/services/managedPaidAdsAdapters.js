// Managed paid-ad providers must be registered here only after the application
// contains a complete provider path for campaign creation, spend reconciliation,
// and hard-stop/pause enforcement. Environment flags cannot manufacture support.
const IMPLEMENTED_MANAGED_ADAPTERS = new Set();

export function isManagedPaidAdsAdapterImplemented(provider) {
  return IMPLEMENTED_MANAGED_ADAPTERS.has(String(provider || '').trim().toLowerCase());
}

export function implementedManagedPaidAdsProviders() {
  return [...IMPLEMENTED_MANAGED_ADAPTERS];
}
