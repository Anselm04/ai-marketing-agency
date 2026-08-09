import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_marketing_agency';
const DB_NAME = process.env.MONGODB_DB_NAME || 'ai_marketing_agency';

function toId(val) {
  if (!val) return val;
  if (val instanceof ObjectId) return val;
  if (ObjectId.isValid(val)) return new ObjectId(val);
  return val;
}

function stripInternal(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { id: _id?.toString?.() || _id, ...rest };
}

class MongoAdapter {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    if (this.client) return this.db;
    this.client = new MongoClient(URI);
    await this.client.connect();
    this.db = this.client.db(DB_NAME);
    console.log('Connected to MongoDB');
    return this.db;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  _col(name) {
    if (!this.db) throw new Error('MongoDB not connected. Call connect() first.');
    return this.db.collection(name);
  }

  // Users
  async createUser(data) {
    const res = await this._col('users').insertOne({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return stripInternal({ ...data, _id: res.insertedId });
  }

  async findUserById(id) {
    const doc = await this._col('users').findOne({ _id: toId(id) });
    return stripInternal(doc);
  }

  async findUserByEmail(email) {
    const doc = await this._col('users').findOne({ email: email.toLowerCase() });
    return stripInternal(doc);
  }

  async updateUser(id, data) {
    await this._col('users').updateOne(
      { _id: toId(id) },
      { $set: { ...data, updatedAt: new Date().toISOString() } }
    );
    return this.findUserById(id);
  }

  async getUsers() {
    const docs = await this._col('users').find().toArray();
    return docs.map(stripInternal);
  }

  // Campaigns
  async createCampaign(data) {
    const res = await this._col('campaigns').insertOne({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return stripInternal({ ...data, _id: res.insertedId });
  }

  async getCampaigns() {
    const docs = await this._col('campaigns').find().sort({ createdAt: -1 }).toArray();
    return docs.map(stripInternal);
  }

  async getCampaignById(id) {
    const doc = await this._col('campaigns').findOne({ _id: toId(id) });
    return stripInternal(doc);
  }

  async updateCampaign(id, data) {
    await this._col('campaigns').updateOne(
      { _id: toId(id) },
      { $set: { ...data, updatedAt: new Date().toISOString() } }
    );
    return this.getCampaignById(id);
  }

  async deleteCampaign(id) {
    await this._col('campaigns').deleteOne({ _id: toId(id) });
    return true;
  }

  // Content
  async createContent(data) {
    const res = await this._col('content').insertOne({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return stripInternal({ ...data, _id: res.insertedId });
  }

  async getContent() {
    const docs = await this._col('content').find().sort({ createdAt: -1 }).toArray();
    return docs.map(stripInternal);
  }

  async updateContent(id, data) {
    await this._col('content').updateOne(
      { _id: toId(id) },
      { $set: { ...data, updatedAt: new Date().toISOString() } }
    );
    return stripInternal(await this._col('content').findOne({ _id: toId(id) }));
  }

  async deleteContent(id) {
    await this._col('content').deleteOne({ _id: toId(id) });
    return true;
  }

  // Leads
  async createLead(data) {
    const res = await this._col('leads').insertOne({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return stripInternal({ ...data, _id: res.insertedId });
  }

  async getLeads() {
    const docs = await this._col('leads').find().sort({ createdAt: -1 }).toArray();
    return docs.map(stripInternal);
  }

  async updateLead(id, data) {
    await this._col('leads').updateOne(
      { _id: toId(id) },
      { $set: { ...data, updatedAt: new Date().toISOString() } }
    );
    return stripInternal(await this._col('leads').findOne({ _id: toId(id) }));
  }

  async deleteLead(id) {
    await this._col('leads').deleteOne({ _id: toId(id) });
    return true;
  }

  // Agents
  async getAgents() {
    const docs = await this._col('agents').find().toArray();
    return docs.map(stripInternal);
  }

  async updateAgent(id, data) {
    await this._col('agents').updateOne(
      { agentId: id },
      { $set: { ...data, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    return stripInternal(await this._col('agents').findOne({ agentId: id }));
  }

  async seedAgents(agents) {
    const existing = await this.getAgents();
    if (existing.length > 0) return;
    await this._col('agents').insertMany(agents.map(a => ({ ...a, createdAt: new Date().toISOString() })));
  }

  // Organizations
  async createOrg(data) {
    const res = await this._col('orgs').insertOne({
      ...data,
      createdAt: new Date().toISOString(),
    });
    return stripInternal({ ...data, _id: res.insertedId });
  }

  async getOrgById(id) {
    const doc = await this._col('orgs').findOne({ _id: toId(id) });
    return stripInternal(doc);
  }

  async updateOrg(id, data) {
    await this._col('orgs').updateOne(
      { _id: toId(id) },
      { $set: { ...data, updatedAt: new Date().toISOString() } }
    );
    return this.getOrgById(id);
  }

  async createInvite(data) {
    const res = await this._col('invites').insertOne({
      ...data,
      createdAt: new Date().toISOString(),
    });
    return stripInternal({ ...data, _id: res.insertedId });
  }

  async getInvitesByOrg(orgId) {
    const docs = await this._col('invites').find({ orgId }).toArray();
    return docs.map(stripInternal);
  }

  async findInviteByToken(token) {
    const doc = await this._col('invites').findOne({ token });
    return stripInternal(doc);
  }

  async deleteInvite(id) {
    await this._col('invites').deleteOne({ _id: toId(id) });
    return true;
  }

  // Billing
  async createSubscription(data) {
    const res = await this._col('subscriptions').insertOne({
      ...data,
      createdAt: new Date().toISOString(),
    });
    return stripInternal({ ...data, _id: res.insertedId });
  }

  async getSubscriptionsByUser(userId) {
    const docs = await this._col('subscriptions').find({ userId }).toArray();
    return docs.map(stripInternal);
  }

  async updateSubscription(id, data) {
    await this._col('subscriptions').updateOne(
      { _id: toId(id) },
      { $set: { ...data, updatedAt: new Date().toISOString() } }
    );
    return true;
  }

  async deleteSubscription(id) {
    await this._col('subscriptions').deleteOne({ _id: toId(id) });
    return true;
  }

  async createPaymentIntent(data) {
    const res = await this._col('payments').insertOne({
      ...data,
      createdAt: new Date().toISOString(),
    });
    return stripInternal({ ...data, _id: res.insertedId });
  }

  // Messages
  async createMessage(data) {
    const res = await this._col('messages').insertOne({
      ...data,
      createdAt: new Date().toISOString(),
    });
    return stripInternal({ ...data, _id: res.insertedId });
  }

  async getMessagesByLead(leadId) {
    const docs = await this._col('messages').find({ leadId }).sort({ createdAt: -1 }).toArray();
    return docs.map(stripInternal);
  }

  async getMessagesByUser(userId) {
    const docs = await this._col('messages').find({ userId }).sort({ createdAt: -1 }).toArray();
    return docs.map(stripInternal);
  }

  async updateMessage(id, data) {
    await this._col('messages').updateOne(
      { _id: toId(id) },
      { $set: { ...data, updatedAt: new Date().toISOString() } }
    );
    return true;
  }

  async deleteMessage(id) {
    await this._col('messages').deleteOne({ _id: toId(id) });
    return true;
  }

  // Exports
  async fullExport() {
    const [users, campaigns, content, leads, agents, orgs, subscriptions, payments] = await Promise.all([
      this._col('users').find().toArray(),
      this._col('campaigns').find().toArray(),
      this._col('content').find().toArray(),
      this._col('leads').find().toArray(),
      this._col('agents').find().toArray(),
      this._col('orgs').find().toArray(),
      this._col('subscriptions').find().toArray(),
      this._col('payments').find().toArray(),
    ]);
    return {
      users: users.map(stripInternal),
      campaigns: campaigns.map(stripInternal),
      content: content.map(stripInternal),
      leads: leads.map(stripInternal),
      agents: agents.map(stripInternal),
      orgs: orgs.map(stripInternal),
      subscriptions: subscriptions.map(stripInternal),
      payments: payments.map(stripInternal),
    };
  }

  // Analytics helpers
  async getCampaignsByOwner(ownerId) {
    const docs = await this._col('campaigns').find({ owner: ownerId }).sort({ createdAt: -1 }).toArray();
    return docs.map(stripInternal);
  }

  async getLeadsByOwner(ownerId) {
    const docs = await this._col('leads').find({ owner: ownerId }).sort({ createdAt: -1 }).toArray();
    return docs.map(stripInternal);
  }

  async getContentByOwner(ownerId) {
    const docs = await this._col('content').find({ owner: ownerId }).sort({ createdAt: -1 }).toArray();
    return docs.map(stripInternal);
  }

  // Token helpers (delegated to store.js for consistency)
  generateToken(userId) {
    // Re-import store for token operations since they're env-based, not db-based
    return import('../utils/store.js').then(m => m.default.generateToken(userId));
  }

  async verifyToken(token) {
    const m = await import('../utils/store.js');
    return m.default.verifyToken(token);
  }

  async comparePassword(plain, hash) {
    const m = await import('../utils/store.js');
    return m.default.comparePassword(plain, hash);
  }

  async hashPassword(password) {
    const m = await import('../utils/store.js');
    return m.default.hashPassword(password);
  }
}

export default new MongoAdapter();
