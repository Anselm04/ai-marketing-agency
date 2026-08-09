import store from '../utils/store.js';

/**
 * JSON file-based adapter (default for dev/test).
 * Wraps the existing store.js with async/await interface.
 */
class JsonAdapter {
  async connect() { return true; }
  async disconnect() { return true; }

  // Users
  async createUser(data) { return store.createUser(data); }
  async findUserById(id) { return store.findUserById(id); }
  async findUserByEmail(email) { return store.findUserByEmail(email); }
  async updateUser(id, data) { return store.updateUser(id, data); }
  async getUsers() { return store.getUsers(); }

  // Campaigns
  async createCampaign(data) { return store.createCampaign(data); }
  async getCampaigns() { return store.getCampaigns(); }
  async getCampaignById(id) { return store.getCampaignById(id); }
  async updateCampaign(id, data) { return store.updateCampaign(id, data); }
  async deleteCampaign(id) { return store.deleteCampaign(id); }

  // Content
  async createContent(data) { return store.createContent(data); }
  async getContent() { return store.getContent(); }
  async updateContent(id, data) { return store.updateContent(id, data); }
  async deleteContent(id) { return store.deleteContent(id); }

  // Leads
  async createLead(data) { return store.createLead(data); }
  async getLeads() { return store.getLeads(); }
  async updateLead(id, data) { return store.updateLead(id, data); }
  async deleteLead(id) { return store.deleteLead(id); }

  // Agents
  async getAgents() { return store.getAgents(); }
  async updateAgent(id, data) { return store.updateAgent(id, data); }
  async seedAgents(data) { return store.seedAgents(data); }

  // Organizations
  async createOrganization(data) { return store.createOrganization(data); }
  async getOrganizationById(id) { return store.getOrganizationById(id); }
  async updateOrganization(id, data) { return store.updateOrganization(id, data); }
  async addMember(orgId, userId, role) { return store.addMember(orgId, userId, role); }
  async removeMember(orgId, userId) { return store.removeMember(orgId, userId); }
  async updateMemberRole(orgId, userId, role) { return store.updateMemberRole(orgId, userId, role); }
  async createInvite(data) { return store.createInvite(data); }
  async getInvitesByOrg(orgId) { return store.getInvitesByOrg(orgId); }
  async findInviteByToken(token) { return store.findInviteByToken(token); }
  async deleteInvite(id) { return store.deleteInvite(id); }

  // Billing / Subscriptions
  async createSubscription(data) { return store.createSubscription(data); }
  async getSubscriptionsByUser(userId) { return store.getSubscriptionsByUser(userId); }
  async updateSubscription(id, data) { return store.updateSubscription(id, data); }
  async deleteSubscription(id) { return store.deleteSubscription(id); }
  async createPaymentIntent(data) { return store.createPaymentIntent(data); }

  // Messages
  async createMessage(data) { return store.createMessage(data); }
  async getMessagesByLead(leadId) { return store.getMessagesByLead(leadId); }
  async getMessagesByUser(userId) { return store.getMessagesByUser(userId); }
  async updateMessage(id, data) { return store.updateMessage(id, data); }
  async deleteMessage(id) { return store.deleteMessage(id); }

  // Exports
  async fullExport() { return store.fullExport(); }

  // Analytics helpers
  async getCampaignsByOwner(ownerId) { return store.getCampaigns().filter(c => c.owner === ownerId); }
  async getLeadsByOwner(ownerId) { return store.getLeads().filter(l => l.owner === ownerId); }
  async getContentByOwner(ownerId) { return store.getContent().filter(c => c.owner === ownerId); }

  // Token helpers (store.js handles these directly)
  generateToken(userId) { return store.generateToken(userId); }
  verifyToken(token) { return store.verifyToken(token); }
  comparePassword(plain, hash) { return store.comparePassword(plain, hash); }
  hashPassword(password) { return store.hashPassword(password); }
  ping() { return store.ping(); }
}

export default new JsonAdapter();
