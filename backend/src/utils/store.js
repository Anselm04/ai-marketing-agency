import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function loadFile(name, defaultVal = []) {
  const file = path.join(dataDir, `${name}.json`);
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return defaultVal; }
}
function saveFile(name, data) {
  fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(data, null, 2));
}

let users = loadFile('users');
let organizations = loadFile('organizations');
let invites = loadFile('invites');
let agents = loadFile('agents');
let campaigns = loadFile('campaigns');
let content = loadFile('content');
let leads = loadFile('leads');
let legalDocs = loadFile('legalDocs');
let tasks = loadFile('tasks');
let subscriptions = loadFile('subscriptions');
let analytics = loadFile('analytics', {});
let settings = loadFile('settings', {});

const USE_MONGO = process.env.USE_MONGO === 'true' || process.env.MONGODB_URI;
let mongoClient = null;
let mongoDb = null;

function toMongoId(val) {
  if (!val) return val;
  if (val instanceof ObjectId) return val;
  if (ObjectId.isValid(val)) return new ObjectId(val);
  return val;
}
function stripMongo(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { id: _id?.toString?.() || _id, ...rest };
}

async function getMongoDb() {
  if (!USE_MONGO) return null;
  if (mongoDb) return mongoDb;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_marketing';
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  mongoDb = mongoClient.db(process.env.MONGODB_DB_NAME || 'ai_marketing');
  console.log('Connected to MongoDB');
  return mongoDb;
}

function col(name) {
  if (!mongoDb) throw new Error('MongoDB not connected');
  return mongoDb.collection(name);
}

const store = {
  _save() {
    if (USE_MONGO) return;
    saveFile('users', users);
    saveFile('organizations', organizations);
    saveFile('invites', invites);
    saveFile('agents', agents);
    saveFile('campaigns', campaigns);
    saveFile('content', content);
    saveFile('leads', leads);
    saveFile('legalDocs', legalDocs);
    saveFile('tasks', tasks);
    saveFile('subscriptions', subscriptions);
    saveFile('analytics', analytics);
    saveFile('settings', settings);
  },

  _id() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); },

  async connectDB() {
    if (USE_MONGO) await getMongoDb();
  },

  async disconnectDB() {
    if (mongoClient) { await mongoClient.close(); mongoClient = null; mongoDb = null; }
  },

  isMongo() { return USE_MONGO && !!mongoDb; },

  getUsers() {
    if (this.isMongo()) return col('users').find().toArray().then(docs => docs.map(stripMongo));
    return Promise.resolve(users);
  },
  async createUser(userData) {
    if (this.isMongo()) {
      const existing = await col('users').findOne({ email: userData.email.toLowerCase() });
      if (existing) throw new Error('User already exists');
      const hashed = await bcrypt.hash(userData.password, 12);
      const user = { id: this._id(), email: userData.email.toLowerCase(), password: hashed, role: userData.role || 'user', profile: userData.profile || {}, createdAt: new Date().toISOString() };
      const res = await col('users').insertOne(user);
      const { password, ...safe } = user;
      return safe;
    }
    const existing = users.find(u => u.email === userData.email.toLowerCase());
    if (existing) throw new Error('User already exists');
    const hashed = await bcrypt.hash(userData.password, 12);
    const user = { id: this._id(), email: userData.email.toLowerCase(), password: hashed, role: userData.role || 'user', profile: userData.profile || {}, createdAt: new Date().toISOString() };
    users.push(user);
    this._save();
    const { password, ...safe } = user;
    return safe;
  },
  async findUserByEmail(email) {
    if (this.isMongo()) return stripMongo(await col('users').findOne({ email: email.toLowerCase() }));
    return users.find(u => u.email === email.toLowerCase());
  },
  async findUserById(id) {
    if (this.isMongo()) return stripMongo(await col('users').findOne({ _id: toMongoId(id) }));
    return users.find(u => u.id === id);
  },
  async updateUser(id, updates) {
    if (this.isMongo()) {
      await col('users').updateOne({ _id: toMongoId(id) }, { $set: { ...updates, updatedAt: new Date().toISOString() } });
      return this.findUserById(id);
    }
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates, id: users[idx].id };
    this._save();
    const { password, ...safe } = users[idx];
    return safe;
  },
  async comparePassword(password, hash) { return bcrypt.compare(password, hash); },
  generateToken(userId) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  },
  verifyToken(token) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
    return jwt.verify(token, process.env.JWT_SECRET);
  },
  async hashPassword(password) { return bcrypt.hash(password, 12); },

  getOrganizations() {
    if (this.isMongo()) return col('orgs').find().toArray().then(docs => docs.map(stripMongo));
    return Promise.resolve(organizations);
  },
  getOrganizationById(id) {
    if (this.isMongo()) return col('orgs').findOne({ _id: toMongoId(id) }).then(stripMongo);
    return organizations.find(o => o.id === id);
  },
  getOrganizationByUserId(userId) {
    if (this.isMongo()) return col('orgs').findOne({ 'members.userId': userId }).then(stripMongo);
    return organizations.find(o => o.members.some(m => m.userId === userId));
  },
  async createOrganization(data) {
    const org = { id: this._id(), name: data.name, ownerId: data.ownerId, members: [{ userId: data.ownerId, role: 'owner', joinedAt: new Date().toISOString() }], createdAt: new Date().toISOString() };
    if (this.isMongo()) { const res = await col('orgs').insertOne(org); return stripMongo({ ...org, _id: res.insertedId }); }
    organizations.push(org); this._save(); return org;
  },
  async updateOrganization(id, updates) {
    if (this.isMongo()) { await col('orgs').updateOne({ _id: toMongoId(id) }, { $set: { ...updates, updatedAt: new Date().toISOString() } }); return this.getOrganizationById(id); }
    const idx = organizations.findIndex(o => o.id === id); if (idx === -1) return null; organizations[idx] = { ...organizations[idx], ...updates, id }; this._save(); return organizations[idx];
  },
  addMember(orgId, userId, role) {
    if (this.isMongo()) return col('orgs').updateOne({ _id: toMongoId(orgId) }, { $addToSet: { members: { userId, role: role || 'member', joinedAt: new Date().toISOString() } } }).then(() => this.getOrganizationById(orgId));
    const org = organizations.find(o => o.id === orgId); if (!org) return null; if (!org.members.some(m => m.userId === userId)) { org.members.push({ userId, role: role || 'member', joinedAt: new Date().toISOString() }); this._save(); } return org;
  },
  removeMember(orgId, userId) {
    if (this.isMongo()) return col('orgs').updateOne({ _id: toMongoId(orgId) }, { $pull: { members: { userId } } }).then(() => this.getOrganizationById(orgId));
    const org = organizations.find(o => o.id === orgId); if (!org) return null; org.members = org.members.filter(m => m.userId !== userId); this._save(); return org;
  },
  updateMemberRole(orgId, userId, role) {
    if (this.isMongo()) return col('orgs').updateOne({ _id: toMongoId(orgId), 'members.userId': userId }, { $set: { 'members.$.role': role } }).then(() => this.getOrganizationById(orgId));
    const org = organizations.find(o => o.id === orgId); if (!org) return null; const member = org.members.find(m => m.userId === userId); if (member) { member.role = role; this._save(); } return org;
  },

  getInvites() {
    if (this.isMongo()) return col('invites').find().toArray().then(docs => docs.map(stripMongo));
    return invites;
  },
  createInvite(data) {
    const invite = { id: this._id(), orgId: data.orgId, email: data.email.toLowerCase(), role: data.role || 'member', token: data.token, expiresAt: data.expiresAt, createdAt: new Date().toISOString() };
    if (this.isMongo()) return col('invites').insertOne(invite).then(res => stripMongo({ ...invite, _id: res.insertedId }));
    invites.push(invite); this._save(); return invite;
  },
  findInviteByToken(token) {
    if (this.isMongo()) return col('invites').findOne({ token, expiresAt: { $gt: new Date().toISOString() } }).then(stripMongo);
    return invites.find(i => i.token === token && new Date(i.expiresAt) > new Date());
  },
  deleteInvite(id) {
    if (this.isMongo()) return col('invites').deleteOne({ _id: toMongoId(id) }).then(() => true);
    const idx = invites.findIndex(i => i.id === id); if (idx === -1) return false; invites.splice(idx, 1); this._save(); return true;
  },

  getAgents() {
    if (this.isMongo()) return col('agents').find().toArray().then(docs => docs.map(stripMongo));
    return Promise.resolve(agents);
  },
  getAgentById(id) {
    if (this.isMongo()) return col('agents').findOne({ $or: [{ _id: toMongoId(id) }, { agentId: id }] }).then(stripMongo);
    return agents.find(a => a.id === id || a.agentId === id);
  },
  createAgent(agent) {
    const a = { id: this._id(), ...agent, createdAt: new Date().toISOString() };
    if (this.isMongo()) return col('agents').insertOne(a).then(res => stripMongo({ ...a, _id: res.insertedId }));
    agents.push(a); this._save(); return a;
  },
  updateAgent(id, updates) {
    if (this.isMongo()) return col('agents').updateOne({ agentId: id }, { $set: { ...updates, updatedAt: new Date().toISOString() } }, { upsert: true }).then(() => this.getAgentById(id));
    const idx = agents.findIndex(a => a.id === id || a.agentId === id); if (idx === -1) return null; agents[idx] = { ...agents[idx], ...updates }; this._save(); return agents[idx];
  },
  deleteAgent(id) {
    if (this.isMongo()) return col('agents').deleteOne({ $or: [{ _id: toMongoId(id) }, { agentId: id }] }).then(() => true);
    const idx = agents.findIndex(a => a.id === id || a.agentId === id); if (idx === -1) return false; agents.splice(idx, 1); this._save(); return true;
  },
  seedAgents(defaults) {
    if (this.isMongo()) return col('agents').countDocuments().then(c => { if (c === 0) return col('agents').insertMany(defaults.map(a => ({ ...a, createdAt: new Date().toISOString() }))); });
    if (agents.length === 0) { agents = defaults.map(a => ({ id: this._id(), ...a, createdAt: new Date().toISOString() })); this._save(); }
  },

  getCampaigns() {
    if (this.isMongo()) return col('campaigns').find().sort({ createdAt: -1 }).toArray().then(docs => docs.map(stripMongo));
    return Promise.resolve(campaigns);
  },
  getCampaignById(id) {
    if (this.isMongo()) return col('campaigns').findOne({ _id: toMongoId(id) }).then(stripMongo);
    return campaigns.find(c => c.id === id);
  },
  createCampaign(campaign) {
    const c = { id: this._id(), ...campaign, createdAt: new Date().toISOString() };
    if (this.isMongo()) return col('campaigns').insertOne(c).then(res => stripMongo({ ...c, _id: res.insertedId }));
    campaigns.push(c); this._save(); return c;
  },
  updateCampaign(id, updates) {
    if (this.isMongo()) return col('campaigns').updateOne({ _id: toMongoId(id) }, { $set: { ...updates, updatedAt: new Date().toISOString() } }).then(() => this.getCampaignById(id));
    const idx = campaigns.findIndex(c => c.id === id); if (idx === -1) return null; campaigns[idx] = { ...campaigns[idx], ...updates }; this._save(); return campaigns[idx];
  },
  deleteCampaign(id) {
    if (this.isMongo()) return col('campaigns').deleteOne({ _id: toMongoId(id) }).then(() => true);
    const idx = campaigns.findIndex(c => c.id === id); if (idx === -1) return false; campaigns.splice(idx, 1); this._save(); return true;
  },

  getContent() {
    if (this.isMongo()) return col('content').find().sort({ createdAt: -1 }).toArray().then(docs => docs.map(stripMongo));
    return Promise.resolve(content);
  },
  createContent(item) {
    const c = { id: this._id(), ...item, createdAt: new Date().toISOString() };
    if (this.isMongo()) return col('content').insertOne(c).then(res => stripMongo({ ...c, _id: res.insertedId }));
    content.push(c); this._save(); return c;
  },
  updateContent(id, updates) {
    if (this.isMongo()) return col('content').updateOne({ _id: toMongoId(id) }, { $set: { ...updates, updatedAt: new Date().toISOString() } }).then(() => col('content').findOne({ _id: toMongoId(id) }).then(stripMongo));
    const idx = content.findIndex(c => c.id === id); if (idx === -1) return null; content[idx] = { ...content[idx], ...updates }; this._save(); return content[idx];
  },
  deleteContent(id) {
    if (this.isMongo()) return col('content').deleteOne({ _id: toMongoId(id) }).then(() => true);
    const idx = content.findIndex(c => c.id === id); if (idx === -1) return false; content.splice(idx, 1); this._save(); return true;
  },

  getLeads() {
    if (this.isMongo()) return col('leads').find().sort({ createdAt: -1 }).toArray().then(docs => docs.map(stripMongo));
    return Promise.resolve(leads);
  },
  createLead(lead) {
    const l = { id: this._id(), ...lead, createdAt: new Date().toISOString() };
    if (this.isMongo()) return col('leads').insertOne(l).then(res => stripMongo({ ...l, _id: res.insertedId }));
    leads.push(l); this._save(); return l;
  },
  updateLead(id, updates) {
    if (this.isMongo()) return col('leads').updateOne({ _id: toMongoId(id) }, { $set: { ...updates, updatedAt: new Date().toISOString() } }).then(() => col('leads').findOne({ _id: toMongoId(id) }).then(stripMongo));
    const idx = leads.findIndex(l => l.id === id); if (idx === -1) return null; leads[idx] = { ...leads[idx], ...updates }; this._save(); return leads[idx];
  },
  deleteLead(id) {
    if (this.isMongo()) return col('leads').deleteOne({ _id: toMongoId(id) }).then(() => true);
    const idx = leads.findIndex(l => l.id === id); if (idx === -1) return false; leads.splice(idx, 1); this._save(); return true;
  },

  getLegalDocs() {
    if (this.isMongo()) return col('legalDocs').find().sort({ createdAt: -1 }).toArray().then(docs => docs.map(stripMongo));
    return Promise.resolve(legalDocs);
  },
  createLegalDoc(doc) {
    const d = { id: this._id(), ...doc, createdAt: new Date().toISOString() };
    if (this.isMongo()) return col('legalDocs').insertOne(d).then(res => stripMongo({ ...d, _id: res.insertedId }));
    legalDocs.push(d); this._save(); return d;
  },

  getTasks() {
    if (this.isMongo()) return col('tasks').find().sort({ createdAt: -1 }).toArray().then(docs => docs.map(stripMongo));
    return Promise.resolve(tasks);
  },
  createTask(task) {
    const t = { id: this._id(), ...task, createdAt: new Date().toISOString() };
    if (this.isMongo()) return col('tasks').insertOne(t).then(res => stripMongo({ ...t, _id: res.insertedId }));
    tasks.push(t); this._save(); return t;
  },

  getSubscriptions() {
    if (this.isMongo()) return col('subscriptions').find().sort({ createdAt: -1 }).toArray().then(docs => docs.map(stripMongo));
    return Promise.resolve(subscriptions);
  },
  createSubscription(sub) {
    const s = { id: this._id(), ...sub, createdAt: new Date().toISOString() };
    if (this.isMongo()) return col('subscriptions').insertOne(s).then(res => stripMongo({ ...s, _id: res.insertedId }));
    subscriptions.push(s); this._save(); return s;
  },
  updateSubscription(id, updates) {
    if (this.isMongo()) return col('subscriptions').updateOne({ _id: toMongoId(id) }, { $set: { ...updates, updatedAt: new Date().toISOString() } }).then(() => col('subscriptions').findOne({ _id: toMongoId(id) }).then(stripMongo));
    const idx = subscriptions.findIndex(s => s.id === id); if (idx === -1) return null; subscriptions[idx] = { ...subscriptions[idx], ...updates }; this._save(); return subscriptions[idx];
  },
  getSubscriptionsByUser(userId) {
    if (this.isMongo()) return col('subscriptions').find({ userId }).sort({ createdAt: -1 }).toArray().then(docs => docs.map(stripMongo));
    return subscriptions.filter(s => s.userId === userId || s.user === userId);
  },

  getAnalytics() {
    if (this.isMongo()) return col('analytics').findOne({ key: 'global' }).then(doc => doc?.data || {});
    return Promise.resolve(analytics);
  },
  async setAnalytics(key, value) {
    if (this.isMongo()) { await col('analytics').updateOne({ key: 'global' }, { $set: { [`data.${key}`]: value, updatedAt: new Date().toISOString() } }, { upsert: true }); return; }
    analytics[key] = value; this._save();
  },

  getSettings() {
    if (this.isMongo()) return col('settings').findOne({ key: 'global' }).then(doc => doc?.data || {});
    return Promise.resolve(settings);
  },
  async setSettings(key, value) {
    if (this.isMongo()) { await col('settings').updateOne({ key: 'global' }, { $set: { [`data.${key}`]: value, updatedAt: new Date().toISOString() } }, { upsert: true }); return; }
    settings[key] = value; this._save();
  },
};

export default store;
