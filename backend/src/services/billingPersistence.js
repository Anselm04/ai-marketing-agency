import pg from 'pg';
import store from '../utils/store.js';

const { Pool } = pg;
let billingPool;

function getBillingPool() {
  if (billingPool) return billingPool;
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error('PostgreSQL connection is required for production billing persistence.');
  }
  billingPool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return billingPool;
}

function usePostgres(adapter) {
  return adapter === store && adapter.isPostgres?.() === true;
}

function assertEventId(eventId) {
  if (!String(eventId || '').trim()) throw new Error('Stripe event id is required.');
}

export async function grantUserCredits(userId, amount, adapter = store) {
  if (!String(userId || '').trim()) throw new Error('User id is required.');
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Credit amount must be a positive integer.');
  }

  if (usePostgres(adapter)) {
    const { rows } = await getBillingPool().query(
      `update marketing.users
       set profile = jsonb_set(
         coalesce(profile, '{}'::jsonb),
         '{credits}',
         to_jsonb(coalesce(nullif(profile->>'credits', '')::integer, 0) + $2::integer),
         true
       ),
       updated_at = now()
       where id = $1
       returning profile`,
      [userId, amount],
    );
    const profile = rows[0]?.profile;
    if (!profile) throw new Error('Billing user not found.');
    return { credits: Number(profile.credits || 0), addedCredits: amount };
  }

  const user = await adapter.findUserById(userId);
  if (!user) throw new Error('Billing user not found.');
  const currentCredits = Number(user.profile?.credits || 0);
  if (!Number.isFinite(currentCredits) || currentCredits < 0) {
    throw new Error('Stored user credits are invalid.');
  }
  const credits = currentCredits + amount;
  await adapter.updateUser(userId, {
    profile: {
      ...(user.profile || {}),
      credits,
    },
  });
  return { credits, addedCredits: amount };
}

export async function claimStripeWebhookEvent(eventId, eventType, adapter = store) {
  assertEventId(eventId);
  const type = String(eventType || 'unknown');

  if (usePostgres(adapter)) {
    const { rows } = await getBillingPool().query(
      `insert into public.stripe_webhook_events (stripe_event_id, event_type)
       values ($1, $2)
       on conflict (stripe_event_id) do nothing
       returning stripe_event_id`,
      [eventId, type],
    );
    return rows.length === 1;
  }

  const key = `stripe_webhook_event:${eventId}`;
  if (await adapter.getSetting(key)) return false;
  await adapter.setSettings(key, { eventType: type, claimedAt: new Date().toISOString() });
  return true;
}

export async function releaseStripeWebhookEvent(eventId, adapter = store) {
  assertEventId(eventId);

  if (usePostgres(adapter)) {
    await getBillingPool().query(
      'delete from public.stripe_webhook_events where stripe_event_id = $1',
      [eventId],
    );
    return;
  }

  await adapter.deleteSetting(`stripe_webhook_event:${eventId}`);
}
