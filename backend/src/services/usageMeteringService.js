import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;
const memoryEvents = [];
let pool = null;

function databaseUrl() {
  if (process.env.NODE_ENV === 'test' && process.env.USAGE_METERING_TEST_DATABASE !== 'true') return null;
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;
}

function getPool() {
  if (pool) return pool;
  const connectionString = databaseUrl();
  if (!connectionString) return null;
  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.USAGE_DB_POOL_MAX || 2),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return pool;
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Usage quantity must be a non-negative number');
  }
  return quantity;
}

function publicUsageEvent(row = {}) {
  return {
    id: row.id,
    userId: row.userId ?? row.user_id,
    metric: row.metric,
    quantity: Number(row.quantity || 0),
    provider: row.provider || null,
    model: row.model || null,
    costUsd: row.costUsd == null && row.cost_usd == null ? null : Number(row.costUsd ?? row.cost_usd),
    metadata: row.metadata || {},
    createdAt: row.createdAt ?? row.created_at,
  };
}

export async function recordUsage({
  userId,
  metric,
  quantity = 1,
  provider = null,
  model = null,
  costUsd = null,
  metadata = {},
  createdAt = new Date().toISOString(),
}) {
  if (!userId) return null;
  if (!metric) throw new Error('Usage metric is required');
  const normalizedQuantity = normalizeQuantity(quantity);
  const normalizedCost = costUsd == null ? null : Number(costUsd);
  if (normalizedCost != null && (!Number.isFinite(normalizedCost) || normalizedCost < 0)) {
    throw new Error('Usage cost must be a non-negative number');
  }

  const db = getPool();
  if (!db) {
    const event = {
      id: `memory-${memoryEvents.length + 1}`,
      userId,
      metric,
      quantity: normalizedQuantity,
      provider,
      model,
      costUsd: normalizedCost,
      metadata,
      createdAt,
    };
    memoryEvents.push(event);
    return event;
  }

  const { rows } = await db.query(
    `insert into marketing.usage_events
      (user_id, metric, quantity, provider, model, cost_usd, metadata, created_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     returning id, user_id, metric, quantity, provider, model, cost_usd, metadata, created_at`,
    [userId, metric, normalizedQuantity, provider, model, normalizedCost, JSON.stringify(metadata || {}), createdAt],
  );
  return rows[0] || null;
}

export async function listUsageEvents(userId) {
  if (!userId) return [];
  const db = getPool();
  if (!db) {
    return memoryEvents
      .filter((event) => String(event.userId) === String(userId))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map(publicUsageEvent);
  }
  const { rows } = await db.query(
    `select id, user_id, metric, quantity, provider, model, cost_usd, metadata, created_at
       from marketing.usage_events
      where user_id = $1
      order by created_at asc, id asc`,
    [userId],
  );
  return rows.map(publicUsageEvent);
}

export async function sumUsage({ userId, metric, since, until = new Date().toISOString() }) {
  if (!userId || !metric) return 0;
  const db = getPool();
  if (!db) {
    const start = since ? new Date(since).getTime() : 0;
    const end = new Date(until).getTime();
    return memoryEvents
      .filter((event) => event.userId === userId && event.metric === metric)
      .filter((event) => {
        const time = new Date(event.createdAt).getTime();
        return time >= start && time < end;
      })
      .reduce((sum, event) => sum + Number(event.quantity || 0), 0);
  }

  const { rows } = await db.query(
    `select coalesce(sum(quantity), 0)::double precision as total
       from marketing.usage_events
      where user_id = $1
        and metric = $2
        and created_at >= $3
        and created_at < $4`,
    [userId, metric, since || '1970-01-01T00:00:00.000Z', until],
  );
  return Number(rows[0]?.total || 0);
}

export async function usageSummary(userId, now = new Date()) {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const until = now.toISOString();

  const [aiTokensMonth, socialPostsDay] = await Promise.all([
    sumUsage({ userId, metric: 'ai_tokens', since: monthStart.toISOString(), until }),
    sumUsage({ userId, metric: 'social_posts', since: dayStart.toISOString(), until }),
  ]);

  return { aiTokensMonth, socialPostsDay, measuredAt: until };
}

export function estimateConfiguredAiCost(provider, usage = {}) {
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const prefix = String(provider || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const inputPerMillion = Number(process.env[`${prefix}_INPUT_USD_PER_1M`] || 0);
  const outputPerMillion = Number(process.env[`${prefix}_OUTPUT_USD_PER_1M`] || 0);
  if (!inputPerMillion && !outputPerMillion) return null;
  return ((promptTokens / 1_000_000) * inputPerMillion) + ((completionTokens / 1_000_000) * outputPerMillion);
}

function totalAiTokens(usage = {}) {
  const explicit = Number(usage.total_tokens ?? usage.totalTokens);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const input = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const output = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  return Math.max(0, input) + Math.max(0, output);
}

export async function recordAiUsage({
  userId,
  provider,
  model,
  operation,
  usage = {},
  createdAt = new Date().toISOString(),
  metadata = {},
}) {
  const quantity = totalAiTokens(usage);
  if (!userId || quantity <= 0) return null;
  return recordUsage({
    userId,
    metric: 'ai_tokens',
    quantity,
    provider,
    model,
    costUsd: estimateConfiguredAiCost(provider, usage),
    metadata: {
      operation,
      promptTokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
      completionTokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0),
      ...metadata,
    },
    createdAt,
  });
}

export async function closeUsageMetering() {
  if (!pool) return;
  try {
    await pool.end();
  } catch (error) {
    logger.warn('Unable to close usage metering pool', { error: error.message });
  } finally {
    pool = null;
  }
}

export function resetMemoryUsageForTests() {
  memoryEvents.splice(0, memoryEvents.length);
}

export { publicUsageEvent };
