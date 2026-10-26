import crypto from 'crypto';
import pg from 'pg';
import store from '../utils/store.js';
import { cancelSubscription } from './stripeService.js';
import { abortMultipartUpload, deleteStoredObject } from './uploadService.js';

const { Pool } = pg;
let pool = null;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;
}

function getPool() {
  if (pool) return pool;
  const connectionString = databaseUrl();
  if (!connectionString) return null;
  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return pool;
}

function connectorEncryptionKey() {
  const source = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) return null;
  return crypto.createHash('sha256').update(source).digest();
}

function decryptConnectorSetting(payload) {
  const key = connectorEncryptionKey();
  if (!key || !payload || payload.version !== 1 || payload.algorithm !== 'aes-256-gcm') return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64url'));
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

async function connectorSessionKeysForUser(userId) {
  const settings = await store.getSettings();
  const keys = [];
  for (const [key, value] of Object.entries(settings || {})) {
    if (key === `user_preferences:${userId}` || key.startsWith(`connector_tokens:${userId}:`)) {
      keys.push(key);
      continue;
    }
    if (key.startsWith('connector_oauth_session:')) {
      const session = decryptConnectorSetting(value);
      if (String(session?.userId || '') === String(userId)) keys.push(key);
    }
    if (key.startsWith('password_reset:') && String(value?.userId || '') === String(userId)) keys.push(key);
  }
  return [...new Set(keys)];
}

function activeStripeSubscriptions(subscriptions = []) {
  return subscriptions.filter((subscription) => (
    subscription?.source === 'stripe'
    && ['active', 'trialing', 'past_due', 'unpaid'].includes(String(subscription?.status || '').toLowerCase())
  ));
}

function addStorageReference(map, key, privateBucket = false) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return;
  const id = `${privateBucket ? 'private' : 'public'}:${normalizedKey}`;
  if (!map.has(id)) map.set(id, { key: normalizedKey, privateBucket: Boolean(privateBucket) });
}

export function collectCustomerStorageReferences({ campaigns = [], content = [], videos = [] } = {}) {
  const objects = new Map();
  const multipartUploads = new Map();
  const records = [...campaigns, ...content, ...videos];

  for (const record of records) {
    if (record?.storageKey) {
      addStorageReference(objects, record.storageKey, record.storageVisibility === 'private');
    }

    const upload = record?.upload;
    if (!upload?.key) continue;
    const privateBucket = upload.privateBucket === true;
    if (upload.status === 'uploading' && upload.uploadId) {
      const id = `${privateBucket ? 'private' : 'public'}:${upload.key}:${upload.uploadId}`;
      multipartUploads.set(id, {
        key: String(upload.key),
        uploadId: String(upload.uploadId),
        privateBucket,
      });
    } else if (upload.status === 'complete') {
      addStorageReference(objects, upload.key, privateBucket);
    }
  }

  return {
    objects: [...objects.values()],
    multipartUploads: [...multipartUploads.values()],
  };
}

async function customerStorageReferences(userId) {
  const [campaigns, content, videos] = await Promise.all([
    store.getCampaignsByOwner(userId),
    store.getContentByOwner(userId),
    typeof store.getVideosByOwner === 'function' ? store.getVideosByOwner(userId) : Promise.resolve([]),
  ]);
  return collectCustomerStorageReferences({ campaigns, content, videos });
}

export async function deleteCustomerStoredObjects(references) {
  let abortedMultipartUploads = 0;
  let deletedStorageObjects = 0;

  for (const upload of references.multipartUploads) {
    await abortMultipartUpload(upload);
    abortedMultipartUploads += 1;
  }
  for (const object of references.objects) {
    const result = await deleteStoredObject(object.key, { privateBucket: object.privateBucket });
    if (result.deleted) deletedStorageObjects += 1;
  }

  return { abortedMultipartUploads, deletedStorageObjects };
}

export async function deleteCustomerAccount({ userId, password }) {
  const user = await store.findUserById(userId);
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404, code: 'user_not_found' });
  if (!password || !(await store.comparePassword(password, user.password))) {
    throw Object.assign(new Error('Password confirmation is incorrect.'), { status: 403, code: 'password_confirmation_failed' });
  }

  const db = getPool();
  if (!db || store.isPostgres?.() !== true) {
    throw Object.assign(new Error('Secure account deletion requires the production PostgreSQL datastore.'), {
      status: 503,
      code: 'account_deletion_store_unavailable',
    });
  }

  const subscriptions = await store.getSubscriptionsByUser(userId);
  const activeStripe = activeStripeSubscriptions(subscriptions);
  for (const subscription of activeStripe) {
    if (!subscription.stripeSubscriptionId) {
      throw Object.assign(new Error('Active Stripe subscription identifier is missing; account deletion was not attempted.'), {
        status: 409,
        code: 'stripe_subscription_id_missing',
      });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      throw Object.assign(new Error('Stripe is unavailable, so the active subscription could not be cancelled. Account deletion was not attempted.'), {
        status: 503,
        code: 'stripe_not_configured',
      });
    }
    const cancelled = await cancelSubscription(subscription.stripeSubscriptionId, { immediate: true });
    if (!cancelled || cancelled.status !== 'canceled') {
      throw Object.assign(new Error('Stripe did not confirm subscription cancellation. Account deletion was not attempted.'), {
        status: 502,
        code: 'stripe_cancel_not_confirmed',
      });
    }
  }

  const [settingKeys, storageReferences] = await Promise.all([
    connectorSessionKeysForUser(userId),
    customerStorageReferences(userId),
  ]);
  const client = await db.connect();
  const counts = {};
  const execDelete = async (name, sql, params = [userId]) => {
    const result = await client.query(sql, params);
    counts[name] = result.rowCount || 0;
  };

  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`account-delete:${userId}`]);

    await execDelete('invites', 'delete from marketing.invites where org_id in (select id from marketing.organizations where owner_id = $1)');

    await client.query(
      `update marketing.organizations
          set members = coalesce((
            select jsonb_agg(member)
              from jsonb_array_elements(coalesce(marketing.organizations.members, '[]'::jsonb)) member
             where member->>'userId' <> $1
          ), '[]'::jsonb),
              updated_at = now()
        where owner_id <> $1
          and exists (
            select 1 from jsonb_array_elements(coalesce(marketing.organizations.members, '[]'::jsonb)) member
             where member->>'userId' = $1
          )`,
      [userId],
    );

    for (const table of ['ad_packs', 'ad_spend', 'avatars', 'campaigns', 'content_items', 'leads', 'social_connections', 'social_posts', 'tasks', 'videos']) {
      await execDelete(table, `delete from marketing.${table} where owner_id = $1`);
    }

    await execDelete('legal_docs', `delete from marketing.legal_docs where data->>'owner' = $1 or data->>'ownerId' = $1`);
    await execDelete('analytics', `delete from marketing.analytics where value->>'userId' = $1 or value->>'owner' = $1 or value->>'ownerId' = $1`);
    await execDelete('usage_events', 'delete from marketing.usage_events where user_id = $1');
    await execDelete('quota_reservations', 'delete from marketing.quota_reservations where user_id = $1');
    await execDelete('subscriptions', 'delete from marketing.subscriptions where user_id = $1');
    await execDelete('organizations', 'delete from marketing.organizations where owner_id = $1');

    if (settingKeys.length) {
      const result = await client.query('delete from marketing.settings where key = any($1::text[])', [settingKeys]);
      counts.settings = result.rowCount || 0;
    } else {
      counts.settings = 0;
    }

    await client.query(
      `update marketing.god_codes
          set data = (coalesce(data, '{}'::jsonb) - 'redeemedByUserId' - 'usedByUserId') || '{"accountDeleted":true}'::jsonb,
              updated_at = now()
        where data->>'redeemedByUserId' = $1 or data->>'usedByUserId' = $1`,
      [userId],
    );

    const storageCleanup = await deleteCustomerStoredObjects(storageReferences);
    await execDelete('user', 'delete from marketing.users where id = $1');
    await client.query('commit');
    return {
      deleted: true,
      cancelledStripeSubscriptions: activeStripe.length,
      deletedRecords: counts,
      ...storageCleanup,
    };
  } catch (error) {
    try { await client.query('rollback'); } catch { /* Preserve the original transaction error. */ }
    throw error;
  } finally {
    client.release();
  }
}

export default deleteCustomerAccount;
