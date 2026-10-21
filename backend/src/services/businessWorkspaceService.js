const FIELD_LIMITS = Object.freeze({
  name: 180,
  company: 180,
  website: 500,
  industry: 120,
  companySize: 80,
  targetAudience: 1000,
  primaryOffer: 1000,
  businessDescription: 3000,
  primaryGoal: 1000,
  preferredTone: 80,
  language: 40,
  timezone: 100,
});

function serviceError(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

export function sanitizeBusinessInput(input = {}) {
  const result = {};
  for (const [field, max] of Object.entries(FIELD_LIMITS)) {
    if (input[field] !== undefined) {
      result[field] = String(input[field] || '').trim().slice(0, max);
    }
  }
  if (!result.name && result.company) result.name = result.company;
  if (!result.company && result.name) result.company = result.name;
  return result;
}

export function createBusinessWorkspaceService(store) {
  return {
    async listBusinesses(ownerId) {
      return store.getBusinessesByOwner(ownerId);
    },

    async requireOwnedBusiness(ownerId, businessId) {
      if (!businessId) return null;
      const business = await store.getBusinessById(businessId);
      if (!business || business.ownerId !== ownerId) {
        throw serviceError('Business not found.', 404, 'business_not_found');
      }
      return business;
    },

    async createBusiness(ownerId, input = {}) {
      const safe = sanitizeBusinessInput(input);
      if (!safe.name) throw serviceError('Business name is required.', 400, 'business_name_required');
      return store.createBusiness({ ...safe, ownerId });
    },

    async updateBusiness(ownerId, businessId, input = {}) {
      const current = await this.requireOwnedBusiness(ownerId, businessId);
      const safe = sanitizeBusinessInput(input);
      const updated = await store.updateBusiness(current.id, safe);
      return updated;
    },

    async deleteBusiness(ownerId, businessId) {
      const current = await this.requireOwnedBusiness(ownerId, businessId);
      const [campaigns, leads] = await Promise.all([
        store.getCampaignsByOwner(ownerId),
        store.getLeadsByOwner(ownerId),
      ]);
      const linked = [...campaigns, ...leads].some((row) => row.businessId === current.id);
      if (linked) {
        throw serviceError(
          'This business still has campaigns or leads. Move or delete them before removing the business.',
          409,
          'business_in_use',
        );
      }
      await store.deleteBusiness(current.id);
      return true;
    },

    filterByBusiness(rows, businessId) {
      if (!businessId) return rows;
      return (rows || []).filter((row) => row.businessId === businessId);
    },
  };
}

export default createBusinessWorkspaceService;
