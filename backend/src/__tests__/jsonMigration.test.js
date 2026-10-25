import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, test } from '@jest/globals';
import { buildMigrationPlan, importJsonSnapshot, snapshotDigest, prepareJsonSnapshot } from '../utils/jsonMigration.js';
import { fixture, change, hash, time } from './fixtures/jsonMigrationFixture.js';

describe('JSON cutover preservation', () => {
  test('retains identifiers, bcrypt hashes, ownership, subscription details and arbitrary JSON settings', () => {
    const plan = buildMigrationPlan(fixture());
    expect(plan.find((p) => p.table === 'users').rows[0]).toMatchObject({ id: 'u1', email: 'user@example.com', password_hash: hash, created_at: time });
    expect(plan.find((p) => p.table === 'campaigns').rows[0]).toMatchObject({ id: 'c1', owner_id: 'u1' });
    expect(plan.find((p) => p.table === 'subscriptions').rows[0]).toMatchObject({ user_id: 'u1', data: { stripeSubscriptionId: 'sub_test' } });
    expect(plan.find((p) => p.table === 'settings').rows).toContainEqual({ key: 'valueNull', value: null });
  });
  test('refuses incomplete snapshots rather than treating missing files as empty', () => {
    const source = fixture(); delete source.files.users;
    expect(() => buildMigrationPlan(source)).toThrow(/files/);
  });
  test('detects changed file contents', () => {
    const source = fixture(); source.files.users.content = '[]';
    expect(() => buildMigrationPlan(source)).toThrow(/checksum/);
  });
  test.each(['unknown files', 'duplicate users', 'orphan owner', 'conflicting owner', 'unknown user fields', 'plain password'])('refuses %s without exposing record contents', (kind) => {
    const source = fixture();
    const user = JSON.parse(source.files.users.content)[0];
    if (kind === 'unknown files') source.files.unknown = source.files.users;
    if (kind === 'duplicate users') change(source, 'users', [user, { ...user, id: 'u2' }]);
    if (kind === 'orphan owner') change(source, 'campaigns', [{ id: 'c', owner: 'missing', createdAt: time }]);
    if (kind === 'conflicting owner') change(source, 'campaigns', [{ id: 'c', owner: 'u1', ownerId: 'other', createdAt: time }]);
    if (kind === 'unknown user fields') change(source, 'users', [{ ...user, stripeCustomer: 'cus_private' }]);
    if (kind === 'plain password') change(source, 'users', [{ ...user, password: 'private-password' }]);
    expect(() => buildMigrationPlan(source)).toThrow();
    try { buildMigrationPlan(source); } catch (error) {
      expect(error.message).not.toMatch(/cus_private|private-password|USER@example/);
    }
  });
  test.each(['2026-02-30T12:00:00Z', '2026-02-29T12:00:00Z', '2026-10-20T24:00:00Z'])('rejects an impossible calendar timestamp %s', (date) => {
    const source = fixture();
    const user = JSON.parse(source.files.users.content)[0];
    change(source, 'users', [{ ...user, createdAt: date }]);
    expect(() => buildMigrationPlan(source)).toThrow(/valid timestamp/);
  });
  test.each(['00', '03', '32', '99'])('rejects an invalid bcrypt cost %s', (cost) => {
    const source = fixture();
    const user = JSON.parse(source.files.users.content)[0];
    change(source, 'users', [{ ...user, password: '$2b$' + cost + '$' + 'a'.repeat(53) }]);
    expect(() => buildMigrationPlan(source)).toThrow(/bcrypt/);
  });
  test('requires reviewed bytes and frozen writes before connecting', async () => {
    const db = { query: () => { throw new Error('must not connect'); } };
    const bytes = Buffer.from(JSON.stringify(fixture()));
    await expect(importJsonSnapshot(db, bytes, { expectedDigest: '0'.repeat(64), writesFrozen: true })).rejects.toThrow(/checksum/);
    await expect(importJsonSnapshot(db, bytes, { expectedDigest: snapshotDigest(bytes) })).rejects.toThrow(/frozen/);
  });
});

describe('protected snapshot files', () => {
  test('copies exact source contents, creates a private file and refuses overwrite', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'marketing-snapshot-'));
    try {
      const source = path.join(directory, 'source'); await fs.mkdir(source);
      const snapshot = fixture();
      for (const [name, file] of Object.entries(snapshot.files)) await fs.writeFile(path.join(source, `${name}.json`), file.content);
      const destination = path.join(directory, 'snapshot.json');
      const summary = await prepareJsonSnapshot(source, destination, { writesFrozen: true });
      const bytes = await fs.readFile(destination);
      expect(summary.sha256).toBe(snapshotDigest(bytes));
      expect(JSON.parse(bytes).files).toEqual(snapshot.files);
      expect((await fs.stat(destination)).mode & 0o777).toBe(0o600);
      expect(summary.counts.users).toBe(1);
      await expect(prepareJsonSnapshot(source, destination, { writesFrozen: true })).rejects.toThrow();
      expect(await fs.readFile(destination)).toEqual(bytes);
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });
  test('rejects missing collections and symlink sources before creating a snapshot', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'marketing-snapshot-'));
    try {
      const source = path.join(directory, 'source'); await fs.mkdir(source);
      const destination = path.join(directory, 'snapshot.json');
      await expect(prepareJsonSnapshot(source, destination, { writesFrozen: true })).rejects.toThrow(/files/);
      const snapshot = fixture();
      for (const [name, file] of Object.entries(snapshot.files)) await fs.writeFile(path.join(source, `${name}.json`), file.content);
      await fs.rename(path.join(source, 'users.json'), path.join(directory, 'users.json'));
      await fs.symlink(path.join(directory, 'users.json'), path.join(source, 'users.json'));
      await expect(prepareJsonSnapshot(source, destination, { writesFrozen: true })).rejects.toThrow(/regular source/);
      await expect(fs.stat(destination)).rejects.toThrow();
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });
});
