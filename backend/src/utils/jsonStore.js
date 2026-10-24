import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { issueSessionToken, verifySessionToken } from './sessionTokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testStore = process.env.NODE_ENV === 'test';
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!testStore && !fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function loadFile(name, defaultVal = []) {
  if (testStore) return defaultVal;
  const file = path.join(dataDir, `${name}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return defaultVal;
  }
}

function saveFile(name, data) {
  if (testStore) return;
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
let godCodes = loadFile('godCodes');

const store = {
  _save() {
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
    saveFile('godCodes', godCodes);
  },

  _id() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  async connectDB() {},
  async disconnectDB() {},
  isMongo() {
    return false;
  },
  isPostgres() {
    return false;
  },

  getUsers() {
    return Promise.resolve(users);
  },
  async createUser(userData) {
    const existing = users.find((u) => u.email === userData.email.toLowerCase());
    if (existing) throw new Error('User already exists');
    const hashed = await bcrypt.hash(userData.password, 12);
    const user = {
      id: this._id(),
      email: userData.email.toLowerCase(),
      password: hashed,
      role: userData.role || 'user',
      profile: userData.profile || {},
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    this._save();
    const { password, ...safe } = user;
    return safe;
  },
  async findUserByEmail(email) {
    return users.find((u) => u.email === email.toLowerCase());
  },
  async findUserById(id) {
    return users.find((u) => u.id === id);
  },
  async updateUser(id, updates) {
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates, id: users[idx].id };
    this._save();
    const { password, ...safe } = users[idx];
    return safe;
  },
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  },
  async setUserPassword(userId, password) {
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return false;
    users[idx].password = await bcrypt.hash(password, 12);
    users[idx].updatedAt = new Date().toISOString();
    this._save();
    return true;
  },
  async generateToken(userId, authenticatedHash) {
    return issueSessionToken(await this.findUserById(userId), authenticatedHash);
  },
  verifyToken(token) {
    return verifySessionToken(token, (userId) => this.findUserById(userId));
  },
  async hashPassword(password) {
    return bcrypt.hash(password, 12);
  },

  getOrganizations() {
    return Promise.resolve(organizations);
  },
  getOrganizationById(id) {
    return organizations.find((o) => o.id === id);
  },
  getOrganizationByUserId(userId) {
    return organizations.find((o) => o.members.some((m) => m.userId === userId));
  },
  async createOrganization(data) {
    const org = {
      id: this._id(),
      name: data.name,
      ownerId: data.ownerId,
      members: [{ userId: data.ownerId, role: 'owner', joinedAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    };
    organizations.push(org);
    this._save();
    return org;
  },
  async updateOrganization(id, updates) {
    const idx = organizations.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    organizations[idx] = { ...organizations[idx], ...updates, id };
    this._save();
    return organizations[idx];
  },
  addMember(orgId, userId, role) {
    const org = organizations.find((o) => o.id === orgId);
    if (!org) return null;
    if (!org.members.some((m) => m.userId === userId)) {
      org.members.push({ userId, role: role || 'member', joinedAt: new Date().toISOString() });
      this._save();
    }
    return org;
  },
  removeMember(orgId, userId) {
    const org = organizations.find((o) => o.id === orgId);
    if (!org) return null;
    org.members = org.members.filter((m) => m.userId !== userId);
    this._save();
    return org;
  },
  updateMemberRole(orgId, userId, role) {
    const org = organizations.find((o) => o.id === orgId);
    if (!org) return null;
    const member = org.members.find((m) => m.userId === userId);
    if (member) {
      member.role = role;
      this._save();
    }
    return org;
  },

  getInvites() {
    return invites;
  },
  createInvite(data) {
    const invite = {
      id: this._id(),
      orgId: data.orgId,
      email: data.email.toLowerCase(),
      role: data.role || 'member',
      token: data.token,
      expiresAt: data.expiresAt,
      createdAt: new Date().toISOString(),
    };
    invites.push(invite);
    this._save();
    return invite;
  },
  findInviteByToken(token) {
    return invites.find((i) => i.token === token && new Date(i.expiresAt) > new Date());
  },
  deleteInvite(id) {
    const idx = invites.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    invites.splice(idx, 1);
    this._save();
    return true;
  },

  getAgents() {
    return Promise.resolve(agents);
  },
  getAgentById(id) {
    return agents.find((a) => a.id === id || a.agentId === id);
  },
  createAgent(agent) {
    const a = { id: this._id(), ...agent, createdAt: new Date().toISOString() };
    agents.push(a);
    this._save();
    return a;
  },
  updateAgent(id, updates) {
    const idx = agents.findIndex((a) => a.id === id || a.agentId === id);
    if (idx === -1) return null;
    agents[idx] = { ...agents[idx], ...updates };
    this._save();
    return agents[idx];
  },
  deleteAgent(id) {
    const idx = agents.findIndex((a) => a.id === id || a.agentId === id);
    if (idx === -1) return false;
    agents.splice(idx, 1);
    this._save();
    return true;
  },
  seedAgents(defaults) {
    if (agents.length === 0) {
      agents = defaults.map((a) => ({ id: this._id(), ...a, createdAt: new Date().toISOString() }));
      this._save();
    }
  },

  getCampaigns() {
    return Promise.resolve(campaigns);
  },
  getCampaignsByOwner(ownerId) {
    return Promise.resolve(campaigns.filter((item) => item.owner === ownerId || item.ownerId === ownerId));
  },
  getCampaignById(id) {
    return campaigns.find((c) => c.id === id);
  },
  createCampaign(campaign) {
    const c = { id: this._id(), ...campaign, createdAt: new Date().toISOString() };
    campaigns.push(c);
    this._save();
    return c;
  },
  updateCampaign(id, updates) {
    const idx = campaigns.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    campaigns[idx] = { ...campaigns[idx], ...updates };
    this._save();
    return campaigns[idx];
  },
  deleteCampaign(id) {
    const idx = campaigns.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    campaigns.splice(idx, 1);
    this._save();
    return true;
  },

  getContent() {
    return Promise.resolve(content);
  },
  getContentByOwner(ownerId) {
    return Promise.resolve(content.filter((item) => item.owner === ownerId || item.ownerId === ownerId));
  },
  createContent(item) {
    const c = { id: this._id(), ...item, createdAt: new Date().toISOString() };
    content.push(c);
    this._save();
    return c;
  },
  updateContent(id, updates) {
    const idx = content.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    content[idx] = { ...content[idx], ...updates };
    this._save();
    return content[idx];
  },
  deleteContent(id) {
    const idx = content.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    content.splice(idx, 1);
    this._save();
    return true;
  },

  getLeads() {
    return Promise.resolve(leads);
  },
  getLeadsByOwner(ownerId) {
    return Promise.resolve(leads.filter((item) => item.owner === ownerId || item.ownerId === ownerId));
  },
  createLead(lead) {
    const l = { id: this._id(), ...lead, createdAt: new Date().toISOString() };
    leads.push(l);
    this._save();
    return l;
  },
  updateLead(id, updates) {
    const idx = leads.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    leads[idx] = { ...leads[idx], ...updates };
    this._save();
    return leads[idx];
  },
  deleteLead(id) {
    const idx = leads.findIndex((l) => l.id === id);
    if (idx === -1) return false;
    leads.splice(idx, 1);
    this._save();
    return true;
  },

  getLegalDocs() {
    return Promise.resolve(legalDocs);
  },
  createLegalDoc(doc) {
    const d = { id: this._id(), ...doc, createdAt: new Date().toISOString() };
    legalDocs.push(d);
    this._save();
    return d;
  },

  getTasks() {
    return Promise.resolve(tasks);
  },
  createTask(task) {
    const t = { id: this._id(), ...task, createdAt: new Date().toISOString() };
    tasks.push(t);
    this._save();
    return t;
  },

  getSubscriptions() {
    return Promise.resolve(subscriptions);
  },
  createSubscription(sub) {
    const s = { id: this._id(), ...sub, createdAt: new Date().toISOString() };
    subscriptions.push(s);
    this._save();
    return s;
  },
  updateSubscription(id, updates) {
    const idx = subscriptions.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    subscriptions[idx] = { ...subscriptions[idx], ...updates };
    this._save();
    return subscriptions[idx];
  },
  getSubscriptionsByUser(userId) {
    return subscriptions.filter((s) => s.userId === userId || s.user === userId);
  },

  getAnalytics() {
    return Promise.resolve(analytics);
  },
  async setAnalytics(key, value) {
    analytics[key] = value;
    this._save();
  },

  getSettings() {
    return Promise.resolve(settings);
  },
  getSetting(key) {
    return Promise.resolve(settings[key] ?? null);
  },
  async takeSetting(key) {
    const value = settings[key] ?? null;
    delete settings[key];
    this._save();
    return value;
  },
  async setSettings(key, value) {
    settings[key] = value;
    this._save();
  },
  async deleteSetting(key) {
    if (!(key in settings)) return false;
    delete settings[key];
    this._save();
    return true;
  },

  getGodCodes() {
    return Promise.resolve(godCodes);
  },
  findGodCodeByHash(hash) {
    return godCodes.find((c) => c.hash === hash);
  },
  createGodCode(row) {
    const c = { id: this._id(), ...row, createdAt: new Date().toISOString() };
    godCodes.push(c);
    this._save();
    return c;
  },
  updateGodCode(id, updates) {
    const idx = godCodes.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    godCodes[idx] = { ...godCodes[idx], ...updates, id: godCodes[idx].id };
    this._save();
    return godCodes[idx];
  },
  consumeGodCode(hash, userId, redeemedAt) {
    const idx = godCodes.findIndex((c) =>
      c.hash === hash
      && !c.isUsed
      && !c.redeemedAt
      && !c.redeemedByUserId
      && !c.usedByUserId
    );
    if (idx === -1) return null;
    godCodes[idx] = {
      ...godCodes[idx],
      encryptedCode: null,
      redeemedAt,
      redeemedByUserId: userId,
      isUsed: true,
      usedAt: redeemedAt,
      usedByUserId: userId,
    };
    this._save();
    return godCodes[idx];
  },
};

export default store;

