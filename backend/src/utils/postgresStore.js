import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { issueSessionToken, verifySessionToken } from './sessionTokens.js';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
  throw new Error('DATABASE_URL or SUPABASE_DB_URL is required for PostgreSQL persistence');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
const nowIso = () => new Date().toISOString();
const stripUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
const safeUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    profile: row.profile || {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
};
const authUser = (row) => {
  if (!row) return null;
  return { ...safeUser(row), password: row.password_hash };
};
const entity = (row) => {
  if (!row) return null;
  const base = row.data || {};
  return {
    ...base,
    id: row.id,
    ...(row.owner_id ? { ownerId: row.owner_id, owner: base.owner ?? row.owner_id } : {}),
    ...(row.user_id ? { userId: row.user_id } : {}),
    createdAt: row.created_at?.toISOString?.() || row.created_at || base.createdAt,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at || base.updatedAt,
  };
};

async function listEntities(table) {
  const { rows } = await pool.query(`select * from marketing.${table} order by created_at desc`);
  return rows.map(entity);
}

async function getEntity(table, entityId) {
  const { rows } = await pool.query(`select * from marketing.${table} where id = $1 limit 1`, [entityId]);
  return entity(rows[0]);
}

async function createEntity(table, payload, extra = {}) {
  const entityId = payload.id || id();
  const createdAt = payload.createdAt || nowIso();
  const data = stripUndefined({ ...payload, id: undefined, createdAt: undefined, updatedAt: undefined });
  const columns = ['id', 'data', 'created_at', 'updated_at'];
  const values = [entityId, data, createdAt, createdAt];
  for (const [column, value] of Object.entries(extra)) {
    columns.push(column);
    values.push(value ?? null);
  }
  const params = values.map((_, index) => `$${index + 1}`).join(', ');
  const { rows } = await pool.query(
    `insert into marketing.${table} (${columns.join(', ')}) values (${params}) returning *`,
    values,
  );
  return entity(rows[0]);
}

async function updateEntity(table, entityId, updates, extra = {}) {
  const current = await getEntity(table, entityId);
  if (!current) return null;
  const merged = { ...current, ...updates, id: entityId };
  delete merged.createdAt;
  delete merged.updatedAt;
  const sets = ['data = $2::jsonb', 'updated_at = now()'];
  const values = [entityId, merged];
  let index = 3;
  for (const [column, value] of Object.entries(extra)) {
    sets.push(`${column} = $${index}`);
    values.push(value ?? null);
    index += 1;
  }
  const { rows } = await pool.query(
    `update marketing.${table} set ${sets.join(', ')} where id = $1 returning *`,
    values,
  );
  return entity(rows[0]);
}

async function deleteEntity(table, entityId) {
  const result = await pool.query(`delete from marketing.${table} where id = $1`, [entityId]);
  return result.rowCount > 0;
}

const store = {
  _id: id,
  async connectDB() {
    await pool.query('select 1');
    return true;
  },
  async disconnectDB() {
    await pool.end();
  },
  isMongo() {
    return false;
  },
  isPostgres() {
    return true;
  },

  async getUsers() {
    const { rows } = await pool.query('select * from marketing.users order by created_at desc');
    return rows.map(safeUser);
  },
  async createUser(userData) {
    const passwordHash = await bcrypt.hash(userData.password, 12);
    const userId = id();
    try {
      const { rows } = await pool.query(
        `insert into marketing.users (id, email, password_hash, role, profile)
         values ($1, lower($2), $3, $4, $5::jsonb)
         returning *`,
        [userId, userData.email, passwordHash, userData.role || 'user', userData.profile || {}],
      );
      return safeUser(rows[0]);
    } catch (error) {
      if (error?.code === '23505') throw new Error('User already exists');
      throw error;
    }
  },
  async findUserByEmail(email) {
    const { rows } = await pool.query('select * from marketing.users where lower(email) = lower($1) limit 1', [email]);
    return authUser(rows[0]);
  },
  async findUserById(userId) {
    const { rows } = await pool.query('select * from marketing.users where id = $1 limit 1', [userId]);
    return authUser(rows[0]);
  },
  async updateUser(userId, updates) {
    const existing = await this.findUserById(userId);
    if (!existing) return null;
    const passwordHash = updates.password ? await bcrypt.hash(updates.password, 12) : null;
    const { rows } = await pool.query(
      `update marketing.users
       set email = lower($2), password_hash = coalesce($3, password_hash), role = $4, profile = $5::jsonb, updated_at = now()
       where id = $1 returning *`,
      [
        userId,
        updates.email || existing.email,
        passwordHash,
        updates.role || existing.role,
        updates.profile || existing.profile || {},
      ],
    );
    return safeUser(rows[0]);
  },
  comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  },
  async setUserPassword(userId, password) {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'update marketing.users set password_hash = $2, updated_at = now() where id = $1',
      [userId, passwordHash],
    );
    return result.rowCount > 0;
  },
  async generateToken(userId, authenticatedHash) {
    return issueSessionToken(await this.findUserById(userId), authenticatedHash);
  },
  verifyToken(token) {
    return verifySessionToken(token, (userId) => this.findUserById(userId));
  },
  hashPassword(password) {
    return bcrypt.hash(password, 12);
  },

  async getOrganizations() {
    const { rows } = await pool.query('select * from marketing.organizations order by created_at desc');
    return rows.map((row) => ({
      ...(row.data || {}),
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      members: row.members || [],
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
    }));
  },
  async getOrganizationById(orgId) {
    const { rows } = await pool.query('select * from marketing.organizations where id = $1 limit 1', [orgId]);
    const row = rows[0];
    return row
      ? {
          ...(row.data || {}),
          id: row.id,
          name: row.name,
          ownerId: row.owner_id,
          members: row.members || [],
          createdAt: row.created_at?.toISOString?.() || row.created_at,
          updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
        }
      : null;
  },
  async getOrganizationByUserId(userId) {
    const { rows } = await pool.query(
      `select * from marketing.organizations
       where owner_id = $1 or members @> $2::jsonb
       order by created_at asc limit 1`,
      [userId, JSON.stringify([{ userId }])],
    );
    const row = rows[0];
    return row
      ? {
          ...(row.data || {}),
          id: row.id,
          name: row.name,
          ownerId: row.owner_id,
          members: row.members || [],
          createdAt: row.created_at?.toISOString?.() || row.created_at,
        }
      : null;
  },
  async createOrganization(data) {
    const orgId = id();
    const members = [{ userId: data.ownerId, role: 'owner', joinedAt: nowIso() }];
    const extras = stripUndefined({ ...data, name: undefined, ownerId: undefined, members: undefined });
    const { rows } = await pool.query(
      `insert into marketing.organizations (id, name, owner_id, members, data)
       values ($1, $2, $3, $4::jsonb, $5::jsonb) returning *`,
      [orgId, data.name, data.ownerId, members, extras],
    );
    return {
      ...(rows[0].data || {}),
      id: rows[0].id,
      name: rows[0].name,
      ownerId: rows[0].owner_id,
      members: rows[0].members,
      createdAt: rows[0].created_at?.toISOString?.() || rows[0].created_at,
    };
  },
  async updateOrganization(orgId, updates) {
    const current = await this.getOrganizationById(orgId);
    if (!current) return null;
    const merged = { ...current, ...updates };
    const data = stripUndefined({ ...merged, id: undefined, name: undefined, ownerId: undefined, members: undefined, createdAt: undefined, updatedAt: undefined });
    const { rows } = await pool.query(
      `update marketing.organizations
       set name = $2, owner_id = $3, members = $4::jsonb, data = $5::jsonb, updated_at = now()
       where id = $1 returning *`,
      [orgId, merged.name, merged.ownerId, merged.members || [], data],
    );
    return {
      ...(rows[0].data || {}),
      id: rows[0].id,
      name: rows[0].name,
      ownerId: rows[0].owner_id,
      members: rows[0].members,
      createdAt: rows[0].created_at?.toISOString?.() || rows[0].created_at,
      updatedAt: rows[0].updated_at?.toISOString?.() || rows[0].updated_at,
    };
  },
  async addMember(orgId, userId, role) {
    const org = await this.getOrganizationById(orgId);
    if (!org) return null;
    if (!org.members.some((member) => member.userId === userId)) {
      org.members.push({ userId, role: role || 'member', joinedAt: nowIso() });
    }
    return this.updateOrganization(orgId, { members: org.members });
  },
  async removeMember(orgId, userId) {
    const org = await this.getOrganizationById(orgId);
    if (!org) return null;
    return this.updateOrganization(orgId, { members: org.members.filter((member) => member.userId !== userId) });
  },
  async updateMemberRole(orgId, userId, role) {
    const org = await this.getOrganizationById(orgId);
    if (!org) return null;
    const members = org.members.map((member) => (member.userId === userId ? { ...member, role } : member));
    return this.updateOrganization(orgId, { members });
  },

  async getInvites() {
    const { rows } = await pool.query('select * from marketing.invites order by created_at desc');
    return rows.map((row) => ({
      ...(row.data || {}),
      id: row.id,
      orgId: row.org_id,
      email: row.email,
      role: row.role,
      token: row.token,
      expiresAt: row.expires_at?.toISOString?.() || row.expires_at,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    }));
  },
  async createInvite(data) {
    const inviteId = id();
    const extras = stripUndefined({ ...data, id: undefined, orgId: undefined, email: undefined, role: undefined, token: undefined, expiresAt: undefined });
    const { rows } = await pool.query(
      `insert into marketing.invites (id, org_id, email, role, token, expires_at, data)
       values ($1, $2, lower($3), $4, $5, $6, $7::jsonb) returning *`,
      [inviteId, data.orgId, data.email, data.role || 'member', data.token, data.expiresAt, extras],
    );
    return {
      ...(rows[0].data || {}),
      id: rows[0].id,
      orgId: rows[0].org_id,
      email: rows[0].email,
      role: rows[0].role,
      token: rows[0].token,
      expiresAt: rows[0].expires_at?.toISOString?.() || rows[0].expires_at,
      createdAt: rows[0].created_at?.toISOString?.() || rows[0].created_at,
    };
  },
  async findInviteByToken(token) {
    const { rows } = await pool.query('select * from marketing.invites where token = $1 and expires_at > now() limit 1', [token]);
    const row = rows[0];
    return row
      ? {
          ...(row.data || {}),
          id: row.id,
          orgId: row.org_id,
          email: row.email,
          role: row.role,
          token: row.token,
          expiresAt: row.expires_at?.toISOString?.() || row.expires_at,
          createdAt: row.created_at?.toISOString?.() || row.created_at,
        }
      : null;
  },
  deleteInvite(inviteId) {
    return deleteEntity('invites', inviteId);
  },

  getAgents() {
    return listEntities('agents');
  },
  async getAgentById(agentId) {
    const { rows } = await pool.query('select * from marketing.agents where id = $1 or agent_id = $1 limit 1', [agentId]);
    return entity(rows[0]);
  },
  createAgent(agent) {
    return createEntity('agents', agent, { agent_id: agent.agentId || agent.id || null });
  },
  async updateAgent(agentId, updates) {
    const current = await this.getAgentById(agentId);
    if (!current) return null;
    return updateEntity('agents', current.id, updates, { agent_id: updates.agentId || current.agentId || null });
  },
  async deleteAgent(agentId) {
    const current = await this.getAgentById(agentId);
    return current ? deleteEntity('agents', current.id) : false;
  },
  async seedAgents(defaults) {
    const existing = await this.getAgents();
    if (existing.length > 0) return;
    for (const agent of defaults) await this.createAgent(agent);
  },

  getCampaigns() {
    return listEntities('campaigns');
  },
  async getCampaignsByOwner(ownerId) {
    const { rows } = await pool.query(
      'select * from marketing.campaigns where owner_id = $1 order by created_at desc',
      [ownerId],
    );
    return rows.map(entity);
  },
  getCampaignById(campaignId) {
    return getEntity('campaigns', campaignId);
  },
  createCampaign(campaign) {
    return createEntity('campaigns', campaign, { owner_id: campaign.ownerId || campaign.owner || null });
  },
  async updateCampaign(campaignId, updates) {
    const current = await getEntity('campaigns', campaignId);
    if (!current) return null;
    const ownerId = updates.ownerId || updates.owner || current.ownerId || current.owner || null;
    return updateEntity('campaigns', campaignId, updates, { owner_id: ownerId });
  },
  deleteCampaign(campaignId) {
    return deleteEntity('campaigns', campaignId);
  },

  getContent() {
    return listEntities('content_items');
  },
  async getContentByOwner(ownerId) {
    const { rows } = await pool.query(
      'select * from marketing.content_items where owner_id = $1 order by created_at desc',
      [ownerId],
    );
    return rows.map(entity);
  },
  createContent(item) {
    return createEntity('content_items', item, { owner_id: item.ownerId || item.owner || null });
  },
  async updateContent(contentId, updates) {
    const current = await getEntity('content_items', contentId);
    if (!current) return null;
    const ownerId = updates.ownerId || updates.owner || current.ownerId || current.owner || null;
    return updateEntity('content_items', contentId, updates, { owner_id: ownerId });
  },
  deleteContent(contentId) {
    return deleteEntity('content_items', contentId);
  },

  getLeads() {
    return listEntities('leads');
  },
  async getLeadsByOwner(ownerId) {
    const { rows } = await pool.query(
      'select * from marketing.leads where owner_id = $1 order by created_at desc',
      [ownerId],
    );
    return rows.map(entity);
  },
  createLead(lead) {
    return createEntity('leads', lead, { owner_id: lead.ownerId || lead.owner || null });
  },
  async updateLead(leadId, updates) {
    const current = await getEntity('leads', leadId);
    if (!current) return null;
    const ownerId = updates.ownerId || updates.owner || current.ownerId || current.owner || null;
    return updateEntity('leads', leadId, updates, { owner_id: ownerId });
  },
  deleteLead(leadId) {
    return deleteEntity('leads', leadId);
  },

  getLegalDocs() {
    return listEntities('legal_docs');
  },
  createLegalDoc(doc) {
    return createEntity('legal_docs', doc);
  },

  getTasks() {
    return listEntities('tasks');
  },
  createTask(task) {
    return createEntity('tasks', task, { owner_id: task.ownerId || task.owner || null });
  },

  getSubscriptions() {
    return listEntities('subscriptions');
  },
  createSubscription(subscription) {
    return createEntity('subscriptions', subscription, { user_id: subscription.userId || subscription.user || null });
  },
  async updateSubscription(subscriptionId, updates) {
    const current = await getEntity('subscriptions', subscriptionId);
    if (!current) return null;
    const userId = updates.userId || updates.user || current.userId || null;
    return updateEntity('subscriptions', subscriptionId, updates, { user_id: userId });
  },
  async getSubscriptionsByUser(userId) {
    const { rows } = await pool.query('select * from marketing.subscriptions where user_id = $1 order by created_at desc', [userId]);
    return rows.map(entity);
  },

  async getAnalytics() {
    const { rows } = await pool.query('select key, value from marketing.analytics');
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  },
  async setAnalytics(key, value) {
    await pool.query(
      `insert into marketing.analytics (key, value) values ($1, $2::jsonb)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, value],
    );
  },

  async getSettings() {
    const { rows } = await pool.query('select key, value from marketing.settings');
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  },
  async getSetting(key) {
    const { rows } = await pool.query(
      'select value from marketing.settings where key = $1 limit 1',
      [key],
    );
    return rows[0]?.value ?? null;
  },
  async takeSetting(key) {
    const { rows } = await pool.query(
      'delete from marketing.settings where key = $1 returning value',
      [key],
    );
    return rows[0]?.value ?? null;
  },
  async setSettings(key, value) {
    await pool.query(
      `insert into marketing.settings (key, value) values ($1, $2::jsonb)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, value],
    );
  },
  async deleteSetting(key) {
    const result = await pool.query('delete from marketing.settings where key = $1', [key]);
    return result.rowCount > 0;
  },

  async getGodCodes() {
    const { rows } = await pool.query('select * from marketing.god_codes order by created_at desc');
    return rows.map((row) => ({ ...(row.data || {}), id: row.id, hash: row.hash, createdAt: row.created_at?.toISOString?.() || row.created_at }));
  },
  async findGodCodeByHash(hash) {
    const { rows } = await pool.query('select * from marketing.god_codes where hash = $1 limit 1', [hash]);
    const row = rows[0];
    return row ? { ...(row.data || {}), id: row.id, hash: row.hash, createdAt: row.created_at?.toISOString?.() || row.created_at } : null;
  },
  async createGodCode(row) {
    const codeId = row.id || id();
    const data = stripUndefined({ ...row, id: undefined, hash: undefined, createdAt: undefined, updatedAt: undefined });
    const { rows } = await pool.query(
      'insert into marketing.god_codes (id, hash, data) values ($1, $2, $3::jsonb) returning *',
      [codeId, row.hash, data],
    );
    return { ...(rows[0].data || {}), id: rows[0].id, hash: rows[0].hash, createdAt: rows[0].created_at?.toISOString?.() || rows[0].created_at };
  },
  async updateGodCode(codeId, updates) {
    const current = (await this.getGodCodes()).find((code) => code.id === codeId);
    if (!current) return null;
    const merged = { ...current, ...updates, id: codeId };
    const data = stripUndefined({ ...merged, id: undefined, hash: undefined, createdAt: undefined, updatedAt: undefined });
    const { rows } = await pool.query(
      'update marketing.god_codes set hash = $2, data = $3::jsonb, updated_at = now() where id = $1 returning *',
      [codeId, merged.hash, data],
    );
    return { ...(rows[0].data || {}), id: rows[0].id, hash: rows[0].hash, createdAt: rows[0].created_at?.toISOString?.() || rows[0].created_at };
  },
  async consumeGodCode(hash, userId, redeemedAt) {
    const patch = {
      encryptedCode: null,
      redeemedAt,
      redeemedByUserId: userId,
      isUsed: true,
      usedAt: redeemedAt,
      usedByUserId: userId,
    };
    const { rows } = await pool.query(
      `update marketing.god_codes
       set data = coalesce(data, '{}'::jsonb) || $3::jsonb,
           updated_at = now()
       where hash = $1
         and coalesce((data->>'isUsed')::boolean, false) = false
         and nullif(data->>'redeemedAt', '') is null
         and nullif(data->>'redeemedByUserId', '') is null
         and nullif(data->>'usedByUserId', '') is null
       returning *`,
      [hash, userId, JSON.stringify(patch)],
    );
    const row = rows[0];
    return row
      ? { ...(row.data || {}), id: row.id, hash: row.hash, createdAt: row.created_at?.toISOString?.() || row.created_at }
      : null;
  },
};

export default store;

