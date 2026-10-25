import crypto from 'node:crypto';

export const hash = '$2b$12$' + 'a'.repeat(53);
export const time = '2026-10-20T12:00:00.000Z';
export function fixture() {
  const values = Object.fromEntries(['users', 'organizations', 'invites', 'agents', 'campaigns', 'content', 'leads', 'legalDocs', 'tasks', 'subscriptions', 'godCodes'].map((key) => [key, []]));
  Object.assign(values, {
    users: [{ id: 'u1', email: 'USER@example.com', password: hash, role: 'user', profile: { name: 'Test' }, createdAt: time }],
    campaigns: [{ id: 'c1', owner: 'u1', name: 'Campaign', createdAt: time }],
    subscriptions: [{ id: 's1', user: 'u1', status: 'active', stripeSubscriptionId: 'sub_test', createdAt: time }],
    settings: { encryptedTokens: { ciphertext: 'synthetic' }, valueNull: null, text: 'hello' }, analytics: { count: 3 },
  });
  return { version: 1, files: Object.fromEntries(Object.entries(values).map(([name, value]) => {
    const content = JSON.stringify(value);
    return [name, { content, sha256: crypto.createHash('sha256').update(content).digest('hex') }];
  })) };
}
export const change = (snapshot, name, value) => {
  const content = JSON.stringify(value);
  snapshot.files[name] = { content, sha256: crypto.createHash('sha256').update(content).digest('hex') };
};

