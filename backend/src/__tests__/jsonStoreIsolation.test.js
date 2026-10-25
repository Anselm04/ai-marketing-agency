import fs from 'node:fs';
import crypto from 'node:crypto';
import { expect, jest, test } from '@jest/globals';
import store from '../utils/jsonStore.js';

test('test users stay in memory without rewriting repository fixtures', async () => {
  const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  try {
    const user = await store.createUser({ email: `isolated-${crypto.randomUUID()}@example.com`, password: 'TestPass123!' });
    expect((await store.findUserById(user.id)).email).toBe(user.email);
    expect(write).not.toHaveBeenCalled();
  } finally {
    write.mockRestore();
  }
});
