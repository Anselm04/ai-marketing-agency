-- Durable customer usage ledger for plan enforcement and cost accounting.
-- Additive only: does not alter or delete existing customer data.

create table if not exists marketing.usage_events (
  id bigint generated always as identity primary key,
  user_id text not null,
  metric text not null,
  quantity double precision not null check (quantity >= 0),
  provider text,
  model text,
  cost_usd numeric(18, 8) check (cost_usd is null or cost_usd >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_metric_created_idx
  on marketing.usage_events (user_id, metric, created_at desc);

alter table marketing.usage_events enable row level security;

comment on table marketing.usage_events is
  'Server-side append-only usage ledger for customer quota enforcement and measured provider cost.';
