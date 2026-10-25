import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import pg from 'pg';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { fixture, change, time } from './fixtures/jsonMigrationFixture.js';
import { queueManualSocialPost } from '../utils/manualSocialQueue.js';
import { importJsonSnapshot, snapshotDigest } from '../utils/jsonMigration.js';

const url = process.env.MARKETING_MIGRATION_TEST_DATABASE_URL;
const databaseTests = url ? describe : describe.skip;
// This suite deliberately creates/drops a schema. Never use DATABASE_URL or a live database.
databaseTests('JSON migration with real PostgreSQL', () => {
  let client;
  let created = false;
  let tables;
  beforeAll(async () => {
    if (!/^\/marketing_migration_test(?:_[a-z0-9]+)?$/.test(new URL(url).pathname)) throw new Error('A dedicated marketing_migration_test database is required');
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('CREATE SCHEMA marketing'); created = true;
    await client.query(`
      CREATE TABLE marketing.users (id text primary key, email text not null, password_hash text not null, role text not null, profile jsonb not null, created_at timestamptz not null, updated_at timestamptz not null);
      CREATE UNIQUE INDEX users_email ON marketing.users(lower(email));
      CREATE TABLE marketing.organizations (id text primary key, name text not null, owner_id text not null, members jsonb not null, data jsonb not null, created_at timestamptz not null, updated_at timestamptz not null);
      CREATE TABLE marketing.invites (id text primary key, org_id text not null, email text not null, role text not null, token text unique not null, expires_at timestamptz not null, data jsonb not null, created_at timestamptz not null);
      CREATE TABLE marketing.settings (key text primary key, value jsonb not null);
      CREATE TABLE marketing.analytics (key text primary key, value jsonb not null);
      CREATE TABLE marketing.usage_events (id text primary key);
    `);
    const entity = 'id text primary key, data jsonb not null, created_at timestamptz not null, updated_at timestamptz not null';
    for (const table of ['campaigns', 'content_items', 'leads', 'tasks', 'social_posts']) await client.query(`CREATE TABLE marketing.${table} (${entity}, owner_id text)`);
    await client.query(`CREATE TABLE marketing.agents (${entity}, agent_id text unique)`);
    await client.query(`CREATE TABLE marketing.legal_docs (${entity})`);
    await client.query(`CREATE TABLE marketing.subscriptions (${entity}, user_id text not null)`);
    await client.query(`CREATE TABLE marketing.god_codes (${entity}, hash text unique not null)`);
    tables = (await client.query("select tablename from pg_tables where schemaname='marketing'")).rows.map(({ tablename }) => `marketing.${tablename}`);
  });
  beforeEach(async () => { await client.query(`TRUNCATE ${tables.join(', ')}`); });
  afterAll(async () => {
    if (created) await client.query('DROP SCHEMA marketing CASCADE');
    await client?.end();
  });
  const run = (snapshot, commit = false) => {
    const bytes = Buffer.from(JSON.stringify(snapshot));
    return importJsonSnapshot(client, bytes, { expectedDigest: snapshotDigest(bytes), writesFrozen: true, commit });
  };
  test('rehearses every collection and leaves no rows; apply retains login and nested values', async () => {
    const snapshot = fixture();
    const password = await bcrypt.hash('migration-test-password', 4);
    const user = JSON.parse(snapshot.files.users.content)[0];
    change(snapshot, 'users', [{ ...user, password }]);
    change(snapshot, 'organizations', [{ id: 'org1', ownerId: 'u1', name: 'Org', members: [{ userId: 'u1', role: 'owner' }], createdAt: time }]);
    change(snapshot, 'invites', [{ id: 'i1', orgId: 'org1', email: 'invite@example.com', token: 'synthetic-token', expiresAt: time, createdAt: time }]);
    change(snapshot, 'agents', [{ id: 'a1', agentId: 'chief', createdAt: time }]);
    change(snapshot, 'content', [{ id: 'text1', ownerId: 'u1', text: "O'Brien; DROP TABLE users;", createdAt: time }]);
    change(snapshot, 'leads', [{ id: 'l1', owner: 'u1', createdAt: time }]);
    change(snapshot, 'tasks', [{ id: 't1', createdAt: time }]);
    change(snapshot, 'legalDocs', [{ id: 'doc1', createdAt: time }]);
    change(snapshot, 'godCodes', [{ id: 'g1', hash: 'synthetic-hash', isUsed: true, createdAt: time }]);
    const rehearsal = await run(snapshot);
    expect(rehearsal.committed).toBe(false);
    for (const table of tables) expect((await client.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n).toBe(0);
    expect((await run(snapshot, true)).committed).toBe(true);
    const migrated = (await client.query('SELECT * FROM marketing.users')).rows[0];
    expect(migrated.id).toBe('u1');
    expect(await bcrypt.compare('migration-test-password', migrated.password_hash)).toBe(true);
    expect(migrated.created_at.toISOString()).toBe(time);
    expect((await client.query("SELECT value FROM marketing.settings WHERE key='text'")).rows[0].value).toBe('hello');
    expect((await client.query("SELECT value FROM marketing.settings WHERE key='valueNull'")).rows[0].value).toBe(null);
    expect((await client.query('SELECT data FROM marketing.content_items')).rows[0].data.text).toBe("O'Brien; DROP TABLE users;");
    expect((await client.query('SELECT user_id, data FROM marketing.subscriptions')).rows[0]).toMatchObject({ user_id: 'u1', data: { stripeSubscriptionId: 'sub_test' } });
  });
  test('occupied newer tables block import, including records outside the legacy mapping', async () => {
    await client.query("INSERT INTO marketing.usage_events VALUES ('existing')");
    await expect(run(fixture(), true)).rejects.toThrow(/not empty/);
    expect((await client.query('SELECT count(*)::int AS n FROM marketing.users')).rows[0].n).toBe(0);
    expect((await client.query('SELECT count(*)::int AS n FROM marketing.usage_events')).rows[0].n).toBe(1);
  });
  test('destination failure rolls back already inserted accounts and hides database details', async () => {
    await client.query("ALTER TABLE marketing.campaigns ADD CONSTRAINT forced_failure CHECK (id <> 'c1')");
    try {
      await expect(run(fixture(), true)).rejects.toThrow('Database details withheld');
      expect((await client.query('SELECT count(*)::int AS n FROM marketing.users')).rows[0].n).toBe(0);
    } finally { await client.query('ALTER TABLE marketing.campaigns DROP CONSTRAINT forced_failure'); }
  });
  test('reapplying a committed snapshot refuses overwrite', async () => {
    await run(fixture(), true);
    await expect(run(fixture(), true)).rejects.toThrow(/not empty/);
    expect((await client.query('SELECT count(*)::int AS n FROM marketing.users')).rows[0].n).toBe(1);
  });
  test('RLS cannot hide occupied destination tables', async () => {
    await client.query("INSERT INTO marketing.settings VALUES ('existing', '{}')");
    await client.query('CREATE ROLE migration_rls_probe');
    try {
      await client.query('GRANT USAGE ON SCHEMA marketing TO migration_rls_probe');
      await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA marketing TO migration_rls_probe');
      await client.query('ALTER TABLE marketing.settings ENABLE ROW LEVEL SECURITY');
      await client.query('SET ROLE migration_rls_probe');
      await expect(run(fixture(), true)).rejects.toThrow('Database details withheld');
    } finally {
      await client.query('RESET ROLE');
      await client.query('ALTER TABLE marketing.settings DISABLE ROW LEVEL SECURITY');
      await client.query('DROP OWNED BY migration_rls_probe');
      await client.query('DROP ROLE migration_rls_probe');
    }
    expect((await client.query('SELECT count(*)::int AS n FROM marketing.users')).rows[0].n).toBe(0);
  });
  test('the operator command prepares, rehearses and applies the reviewed snapshot', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'marketing-cli-'));
    const execute = promisify(execFile);
    const script = fileURLToPath(new URL('../../scripts/migrate-json.js', import.meta.url));
    try {
      const source = path.join(directory, 'source'); await fs.mkdir(source);
      for (const [name, file] of Object.entries(fixture().files)) await fs.writeFile(path.join(source, `${name}.json`), file.content);
      const snapshot = path.join(directory, 'snapshot.json');
      const prepared = await execute(process.execPath, [script, 'prepare', '--source', source, '--out', snapshot, '--writes-frozen']);
      const summary = JSON.parse(prepared.stdout);
      const args = ['--snapshot', snapshot, '--sha256', summary.sha256, '--writes-frozen'];
      const env = { ...process.env, DATABASE_URL: url };
      const rehearsal = await execute(process.execPath, [script, 'rehearse', ...args], { env });
      expect(JSON.parse(rehearsal.stdout).committed).toBe(false);
      expect((await client.query('SELECT count(*)::int AS n FROM marketing.users')).rows[0].n).toBe(0);
      const applied = await execute(process.execPath, [script, 'apply', ...args], { env });
      expect(JSON.parse(applied.stdout).committed).toBe(true);
      await expect(execute(process.execPath, [script, 'apply', ...args], { env })).rejects.toMatchObject({ code: 1 });
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });

  test('manual queue update preserves ownership and concurrent publication state', async () => {
    await client.query("INSERT INTO marketing.social_posts (id, owner_id, data, created_at, updated_at) VALUES ('post-1', 'u1', '{\"body\":\"Keep this copy\",\"status\":\"draft\"}', now(), now())");
    expect(await queueManualSocialPost(client, 'post-1', 'other-user')).toBeNull();
    const queued = await queueManualSocialPost(client, 'post-1', 'u1');
    expect(queued.data).toMatchObject({ body: 'Keep this copy', status: 'queued', scheduledAt: null, queueMode: 'manual', automaticPublishing: false });
    const publisher = new pg.Client({ connectionString: url });
    await publisher.connect();
    try {
      await publisher.query('BEGIN');
      await publisher.query("UPDATE marketing.social_posts SET data = data || '{\"published\":true,\"status\":\"published\",\"externalPostId\":\"real-post\"}'::jsonb WHERE id='post-1'");
      const staleQueue = queueManualSocialPost(client, 'post-1', 'u1');
      await publisher.query('COMMIT');
      expect(await staleQueue).toBeNull();
      const saved = (await client.query("SELECT data FROM marketing.social_posts WHERE id='post-1'")).rows[0].data;
      expect(saved).toMatchObject({ published: true, status: 'published', externalPostId: 'real-post' });
    } finally { await publisher.query('ROLLBACK'); await publisher.end(); }
  });

});
