import pg from 'pg';

const { Pool } = pg;
const STRIPE_WEBHOOK_SECRET_NAME = 'marketing_stripe_webhook_secret';
let pool = null;

function databaseUrl(env) {
  return env.DATABASE_URL || env.SUPABASE_DB_URL || null;
}

function getPool(env) {
  if (pool) return pool;
  const connectionString = databaseUrl(env);
  if (!connectionString) return null;
  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
    max: 2,
  });
  return pool;
}

export async function getStripeWebhookSecret({ env = process.env, query = null } = {}) {
  const environmentSecret = String(env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (environmentSecret) return environmentSecret;

  if (!databaseUrl(env)) return null;

  try {
    const runQuery = query || ((text, params) => getPool(env).query(text, params));
    const { rows } = await runQuery(
      `select decrypted_secret
         from vault.decrypted_secrets
        where name = $1
        order by updated_at desc
        limit 1`,
      [STRIPE_WEBHOOK_SECRET_NAME],
    );
    const vaultSecret = String(rows?.[0]?.decrypted_secret || '').trim();
    return vaultSecret || null;
  } catch {
    return null;
  }
}

export async function stripeWebhookVerificationConfigured(options = {}) {
  return Boolean(await getStripeWebhookSecret(options));
}

export { STRIPE_WEBHOOK_SECRET_NAME };
