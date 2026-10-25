import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Explicit legacy jsonStore._save() mapping. Unknown/missing files require reconciliation.
const collections = {
  users: 'users', organizations: 'organizations', invites: 'invites', agents: 'agents',
  campaigns: 'campaigns', content: 'content_items', leads: 'leads', legalDocs: 'legal_docs',
  tasks: 'tasks', subscriptions: 'subscriptions', analytics: 'analytics', settings: 'settings', godCodes: 'god_codes',
};
const jsonColumns = new Set(['data', 'profile', 'members', 'value']);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (location, reason) => { throw new Error(`Migration refused: ${location}: ${reason}`); };
export const snapshotDigest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const exactKeys = (value, keys) => object(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const text = (value, location) => {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) fail(location, 'nonempty text required');
  return value;
};
const timestamp = (value, location) => {
  const parts = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!parts || !Number.isFinite(Date.parse(value))) fail(location, 'valid timestamp required');
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) fail(location, 'valid timestamp required');
  return new Date(value).toISOString();
};
function reference(row, fields, ids, location, required = true) {
  const values = fields.map((key) => row[key]).filter((value) => value != null);
  if (!values.length && !required) return null;
  if (!values.length || values.some((value) => value !== values[0]) || !ids.has(values[0])) fail(location, 'missing, conflicting or orphaned reference');
  return values[0];
}

export function buildMigrationPlan(snapshot) {
  if (!exactKeys(snapshot, ['version', 'files']) || snapshot.version !== 1 || !exactKeys(snapshot.files, Object.keys(collections))) fail('snapshot', 'all supported files required, with no unknown files');
  const source = {};
  for (const name of Object.keys(collections)) {
    const file = snapshot.files[name];
    if (!exactKeys(file, ['content', 'sha256']) || typeof file.content !== 'string' || snapshotDigest(file.content) !== file.sha256) fail(name, 'checksum mismatch');
    try { source[name] = JSON.parse(file.content); } catch { fail(name, 'invalid JSON'); }
    if (['analytics', 'settings'].includes(name)) {
      if (!object(source[name])) fail(name, 'object required');
    } else if (!Array.isArray(source[name]) || source[name].some((row) => !object(row))) fail(name, 'array of objects required');
  }
  const userIds = new Set(source.users.map((row) => row.id));
  const orgIds = new Set(source.organizations.map((row) => row.id));
  const emails = new Set();
  const unique = { agent_id: new Set(), hash: new Set(), token: new Set() };
  const plan = [];
  for (const [name, table] of Object.entries(collections)) {
    if (['analytics', 'settings'].includes(name)) {
      plan.push({ table, rows: Object.entries(source[name]).map(([key, value]) => ({ key: text(key, name), value })) });
      continue;
    }
    const ids = new Set();
    const rows = source[name].map((row, index) => {
      const loc = `${name}[${index}]`;
      const id = text(row.id, loc);
      if (ids.has(id)) fail(loc, 'duplicate identifier');
      ids.add(id);
      const created_at = timestamp(row.createdAt, loc);
      const updated_at = timestamp(row.updatedAt ?? row.createdAt, loc);
      if (name === 'users') {
        const allowed = ['id', 'email', 'password', 'role', 'profile', 'createdAt', 'updatedAt'];
        if (Object.keys(row).some((key) => !allowed.includes(key))) fail(loc, 'unmapped user fields require reconciliation');
        const email = text(row.email, loc).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || emails.has(email)) fail(loc, 'invalid or duplicate email');
        emails.add(email);
        if (!/^\$2[ab]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/.test(row.password || '')) fail(loc, 'bcrypt password hash required');
        if (!object(row.profile ?? {})) fail(loc, 'profile object required');
        return { id, email, password_hash: row.password, role: text(row.role ?? 'user', loc), profile: row.profile ?? {}, created_at, updated_at };
      }
      // Keep the original payload as JSONB, including unfamiliar fields and timestamps.
      const result = { id, data: row, created_at, updated_at };
      if (name === 'organizations') {
        result.name = text(row.name, loc);
        result.owner_id = reference(row, ['ownerId'], userIds, loc);
        if (!Array.isArray(row.members) || row.members.some((member) => !object(member) || !userIds.has(member.userId))) fail(loc, 'invalid organization members');
        result.members = row.members;
      } else if (name === 'invites') {
        result.org_id = reference(row, ['orgId'], orgIds, loc);
        result.email = text(row.email, loc).trim().toLowerCase();
        result.role = text(row.role ?? 'member', loc);
        result.token = text(row.token, loc);
        result.expires_at = timestamp(row.expiresAt, loc);
        delete result.updated_at;
      } else if (name === 'subscriptions') {
        result.user_id = reference(row, ['userId', 'user'], userIds, loc);
      } else if (['campaigns', 'content', 'leads', 'tasks'].includes(name)) {
        result.owner_id = reference(row, ['ownerId', 'owner'], userIds, loc, name !== 'tasks');
      } else if (name === 'agents') {
        result.agent_id = row.agentId == null ? null : text(row.agentId, loc);
      } else if (name === 'godCodes') {
        result.hash = text(row.hash, loc);
      }
      for (const key of Object.keys(unique)) {
        if (result[key] == null) continue;
        if (unique[key].has(result[key])) fail(loc, 'duplicate unique field');
        unique[key].add(result[key]);
      }
      return result;
    });
    plan.push({ table, rows });
  }
  return plan;
}

export async function prepareJsonSnapshot(sourceDirectory, destination, { writesFrozen = false } = {}) {
  if (!writesFrozen) fail('source', 'writes must be frozen before snapshot');
  const names = Object.keys(collections).map((name) => `${name}.json`).sort();
  const listJson = async () => (await fs.readdir(sourceDirectory)).filter((name) => name.endsWith('.json')).sort();
  if ((await listJson()).join('|') !== names.join('|')) fail('source', 'all supported files required, with no unknown JSON files');
  const files = {};
  for (const name of Object.keys(collections)) {
    const file = path.join(sourceDirectory, `${name}.json`);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) fail(name, 'regular source file required');
    const content = await fs.readFile(file, 'utf8');
    files[name] = { content, sha256: snapshotDigest(content) };
  }
  const snapshot = { version: 1, files };
  const plan = buildMigrationPlan(snapshot);
  // Detect edits during capture. The operator must still stop all writers first.
  for (const [name, file] of Object.entries(files)) {
    if (snapshotDigest(await fs.readFile(path.join(sourceDirectory, `${name}.json`))) !== file.sha256) fail(name, 'source changed during snapshot');
  }
  if ((await listJson()).join('|') !== names.join('|')) fail('source', 'file set changed during snapshot');
  const bytes = Buffer.from(JSON.stringify(snapshot));
  const handle = await fs.open(destination, 'wx', 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  return { sha256: snapshotDigest(bytes), counts: Object.fromEntries(plan.map(({ table, rows }) => [table, rows.length])) };
}

export async function importJsonSnapshot(client, bytes, { expectedDigest, writesFrozen = false, commit = false } = {}) {
  if (!writesFrozen) fail('source', 'writes must remain frozen');
  if (!/^[a-f0-9]{64}$/.test(expectedDigest || '') || snapshotDigest(bytes) !== expectedDigest) fail('snapshot', 'reviewed checksum required');
  let snapshot;
  try { snapshot = JSON.parse(bytes.toString('utf8')); } catch { fail('snapshot', 'invalid JSON'); }
  const plan = buildMigrationPlan(snapshot);
  let begun = false;
  try {
    await client.query('BEGIN'); begun = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    // RLS must never make an occupied destination look empty.
    await client.query('SET LOCAL row_security = off');
    const { rows: tables } = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'marketing' ORDER BY tablename");
    const tableNames = tables.map(({ tablename }) => tablename);
    if (plan.some(({ table }) => !tableNames.includes(table))) fail('database', 'required tables missing');
    // Discover all marketing tables, including tables beyond the legacy adapter. Block writers until commit/rollback.
    const quoted = tableNames.map((name) => `marketing."${name.replaceAll('"', '""')}"`);
    await client.query(`LOCK TABLE ${quoted.join(', ')} IN ACCESS EXCLUSIVE MODE`);
    for (const table of quoted) {
      const { rows } = await client.query(`SELECT EXISTS (SELECT 1 FROM ${table} LIMIT 1) AS occupied`);
      if (rows[0].occupied) fail('database', 'destination is not empty; reconciliation required');
    }
    for (const { table, rows } of plan) {
      for (const row of rows) {
        const keys = Object.keys(row);
        const values = keys.map((key) => jsonColumns.has(key) ? JSON.stringify(row[key]) : row[key]);
        const params = keys.map((key, index) => `$${index + 1}::${jsonColumns.has(key) ? 'jsonb' : key.endsWith('_at') ? 'timestamptz' : 'text'}`);
        await client.query(`INSERT INTO marketing.${table} (${keys.join(', ')}) VALUES (${params.join(', ')})`, values);
        const condition = keys.map((key, index) => `${key} IS NOT DISTINCT FROM ${params[index]}`).join(' AND ');
        const { rows: verified } = await client.query(`SELECT count(*)::int AS count FROM marketing.${table} WHERE ${condition}`, values);
        if (verified[0].count !== 1) fail('database', 'row verification failed');
      }
      const { rows: counted } = await client.query(`SELECT count(*)::int AS count FROM marketing.${table}`);
      if (counted[0].count !== rows.length) fail('database', 'row count verification failed');
    }
    await client.query(commit ? 'COMMIT' : 'ROLLBACK'); begun = false;
    return { committed: commit, sha256: expectedDigest, counts: Object.fromEntries(plan.map(({ table, rows }) => [table, rows.length])) };
  } catch (error) {
    if (begun) await client.query('ROLLBACK').catch(() => {});
    // pg errors can include customer values/SQL. Expose only our validation messages.
    if (error.message?.startsWith('Migration refused:')) throw error;
    throw new Error('Migration failed; transaction rollback attempted. Database details withheld.');
  }
}
