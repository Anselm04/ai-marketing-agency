import { expect, jest, test } from '@jest/globals';

const query = jest.fn().mockResolvedValue({ rows: [{ id: 'user-1', email: 'person@example.com', password_hash: 'reset-hash', role: 'user', profile: {} }] });
jest.unstable_mockModule('pg', () => ({ default: { Pool: class { query = query; } } }));
const originalUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgres://unused-test-database';
const { default: store } = await import('../utils/postgresStore.js');
if (originalUrl == null) delete process.env.DATABASE_URL;
else process.env.DATABASE_URL = originalUrl;

test('a profile-only update cannot write a pre-reset password hash back to PostgreSQL', async () => {
  const lookup = jest.spyOn(store, 'findUserById').mockResolvedValue({ id: 'user-1', email: 'person@example.com', password: 'pre-reset-hash', role: 'user', profile: {} });
  try {
    await store.updateUser('user-1', { profile: { company: 'New company' } });
    const [sql, parameters] = query.mock.calls[0];
    expect(parameters[2]).toBeNull();
    expect(sql).toMatch(/password_hash\s*=\s*coalesce\(\$3,\s*password_hash\)/i);
  } finally {
    lookup.mockRestore();
  }
});
