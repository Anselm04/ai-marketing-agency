import { createHmac, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';

function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
  return process.env.JWT_SECRET;
}

function credentialVersion(user) {
  if (!user?.id || !user.password) throw new Error('Session account is unavailable');
  return createHmac('sha256', secret())
    .update(JSON.stringify(['marketing-session-v1', user.id, user.password]))
    .digest('hex');
}

export function issueSessionToken(user, authenticatedHash) {
  if (authenticatedHash !== undefined && user?.password !== authenticatedHash) {
    throw Object.assign(new Error('Credentials changed; please sign in again'), { code: 'credentials_changed' });
  }
  return jwt.sign({ userId: user.id, credentialVersion: credentialVersion(user) }, secret(), {
    expiresIn: '7d', algorithm: 'HS256',
  });
}

export async function verifySessionToken(token, findUser) {
  const decoded = jwt.verify(token, secret(), { algorithms: ['HS256'] });
  if (typeof decoded !== 'object' || typeof decoded.userId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(decoded.credentialVersion || '')) {
    throw new Error('Session expired; please sign in again');
  }
  const user = await findUser(decoded.userId);
  const expected = Buffer.from(credentialVersion(user), 'hex');
  const actual = Buffer.from(decoded.credentialVersion, 'hex');
  if (!timingSafeEqual(actual, expected)) throw new Error('Session expired; please sign in again');
  return decoded;
}
