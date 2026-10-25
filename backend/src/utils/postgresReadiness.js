// Resolve the columns consumed by the adapters and quota/billing services without reading customer rows.
const entityColumns = 'id, data, created_at, updated_at';
const relations = {
  'marketing.users': 'id, email, password_hash, role, profile, created_at, updated_at',
  'marketing.organizations': 'id, name, owner_id, members, data, created_at, updated_at',
  'marketing.invites': 'id, org_id, email, role, token, expires_at, data, created_at',
  'marketing.agents': `${entityColumns}, agent_id`,
  'marketing.campaigns': `${entityColumns}, owner_id`,
  'marketing.content_items': `${entityColumns}, owner_id`,
  'marketing.leads': `${entityColumns}, owner_id`,
  'marketing.legal_docs': entityColumns,
  'marketing.tasks': `${entityColumns}, owner_id`,
  'marketing.subscriptions': `${entityColumns}, user_id`,
  'marketing.analytics': 'key, value, updated_at',
  'marketing.settings': 'key, value, updated_at',
  'marketing.god_codes': `${entityColumns}, hash`,
  'marketing.social_connections': `${entityColumns}, owner_id, platform`,
  'marketing.social_posts': `${entityColumns}, owner_id`,
  'marketing.videos': `${entityColumns}, owner_id`,
  'marketing.avatars': `${entityColumns}, owner_id`,
  'marketing.ad_packs': `${entityColumns}, owner_id`,
  'marketing.ad_spend': `${entityColumns}, owner_id`,
  'marketing.usage_events': 'id, user_id, metric, quantity, provider, model, cost_usd, metadata, created_at',
  'marketing.quota_reservations': 'id, user_id, metric, quantity, window_start, window_end, expires_at, created_at',
  'marketing.rate_limit_windows': 'key_hash, window_start, request_count, updated_at',
  'public.stripe_webhook_events': 'stripe_event_id, event_type',
};

export const POSTGRES_READINESS_SQL = Object.entries(relations)
  .map(([table, columns]) => `select ${columns} from ${table} limit 0`)
  .join(';\n');
