import crypto from 'crypto';
import store from '../utils/store.js';

const PREF_PREFIX = 'user_preferences';

const DEFAULT_PREFERENCES = {
  language: 'en',
  timezone: 'UTC',
  theme: 'system',
  postingWindowStartHour: 8,
  postingWindowEndHour: 21,
  aiOptimizationEnabled: true,
  emailNotifications: true,
  marketingNotifications: true,
  dashboard: {
    compactMode: false,
    showTips: true,
  },
};

function secretMaterial() {
  const source = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!source || source.length < 32)) {
    throw new Error('ENCRYPTION_KEY (or JWT_SECRET) must be at least 32 characters in production');
  }
  return source || 'development-only-account-memory-secret-do-not-use-in-production';
}

function keyForUser(userId) {
  return crypto
    .createHash('sha256')
    .update(secretMaterial() + ':' + userId)
    .digest();
}

function storageKey(userId) {
  return PREF_PREFIX + ':' + userId;
}

function sanitizePreferences(input = {}) {
  const dashboard = input.dashboard && typeof input.dashboard === 'object' ? input.dashboard : {};
  return {
    language: String(input.language || DEFAULT_PREFERENCES.language).slice(0, 20),
    timezone: String(input.timezone || DEFAULT_PREFERENCES.timezone).slice(0, 100),
    theme: ['light', 'dark', 'system'].includes(input.theme) ? input.theme : DEFAULT_PREFERENCES.theme,
    postingWindowStartHour: Math.max(0, Math.min(Number(input.postingWindowStartHour ?? DEFAULT_PREFERENCES.postingWindowStartHour), 23)),
    postingWindowEndHour: Math.max(0, Math.min(Number(input.postingWindowEndHour ?? DEFAULT_PREFERENCES.postingWindowEndHour), 23)),
    aiOptimizationEnabled: input.aiOptimizationEnabled !== false,
    emailNotifications: input.emailNotifications !== false,
    marketingNotifications: input.marketingNotifications !== false,
    dashboard: {
      compactMode: dashboard.compactMode === true,
      showTips: dashboard.showTips !== false,
    },
  };
}

function encrypt(userId, value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyForUser(userId), iv);
  cipher.setAAD(Buffer.from('account-memory:' + userId, 'utf8'));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: encrypted.toString('base64url'),
    updatedAt: new Date().toISOString(),
  };
}

function decrypt(userId, payload) {
  if (!payload || payload.version !== 1 || payload.algorithm !== 'aes-256-gcm') return null;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      keyForUser(userId),
      Buffer.from(payload.iv, 'base64url'),
    );
    decipher.setAAD(Buffer.from('account-memory:' + userId, 'utf8'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
    const clear = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64url')),
      decipher.final(),
    ]);
    return JSON.parse(clear.toString('utf8'));
  } catch {
    return null;
  }
}

export async function getUserPreferences(userId) {
  const stored = await store.getSetting(storageKey(userId));
  const decrypted = decrypt(userId, stored);
  return sanitizePreferences({ ...DEFAULT_PREFERENCES, ...(decrypted || {}) });
}

export async function saveUserPreferences(userId, updates = {}) {
  const current = await getUserPreferences(userId);
  const next = sanitizePreferences({
    ...current,
    ...updates,
    dashboard: {
      ...(current.dashboard || {}),
      ...(updates.dashboard || {}),
    },
  });
  await store.setSettings(storageKey(userId), encrypt(userId, next));
  return next;
}

export async function deleteUserPreferences(userId) {
  return store.deleteSetting(storageKey(userId));
}

export { DEFAULT_PREFERENCES, sanitizePreferences };
