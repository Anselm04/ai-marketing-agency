import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';

const CANONICAL_OWNER_EMAIL = 'anselm.perkins@gmail.com';

function serverSecret() {
  const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET || '';
  if (!secret) throw new Error('Server secret is not configured');
  return secret;
}

function aesKey(purpose) {
  return scryptSync(serverSecret(), `marketing:${purpose}:v1`, 32);
}

export function normalizeEmail(email) {
  return (email ?? '').trim().toLowerCase();
}

export function canonicalOwnerEmail() {
  return CANONICAL_OWNER_EMAIL;
}

export function hmacUtf8(value, purpose) {
  return createHmac('sha256', serverSecret()).update(`${purpose}:${value}`).digest('hex');
}

export function hmacEqualHex(a, b) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function isOwnerEmail(email) {
  const needle = normalizeEmail(email);
  if (!needle) return false;
  try {
    const expected = hmacUtf8(CANONICAL_OWNER_EMAIL, 'owner-email');
    const actual = hmacUtf8(needle, 'owner-email');
    return hmacEqualHex(actual, expected);
  } catch {
    return needle === CANONICAL_OWNER_EMAIL;
  }
}

export function encryptUtf8(plain, purpose) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey(purpose), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptUtf8(payload, purpose) {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < 29) throw new Error('Invalid ciphertext');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', aesKey(purpose), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function hashGodCode(raw) {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, '');
  return createHash('sha256').update(`god-code:${normalized}:${serverSecret()}`).digest('hex');
}

export function encryptGodCode(raw) {
  return encryptUtf8(raw.trim().toUpperCase().replace(/\s+/g, ''), 'god-code');
}

export function mintGodCode() {
  const raw = randomBytes(9).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  return `TM-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function requireOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isOwnerEmail(req.user.email)) {
    return res.status(403).json({ error: 'Owner only' });
  }
  return next();
}
