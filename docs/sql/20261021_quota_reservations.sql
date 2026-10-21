create table if not exists marketing.quota_reservations (
  id text primary key,
  user_id text not null,
  metric text not null,
  quantity double precision not null check (quantity > 0),
  window_start timestamptz not null,
  window_end timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists quota_reservations_active_idx
  on marketing.quota_reservations (user_id, metric, window_start, window_end, expires_at);

alter table marketing.quota_reservations enable row level security;

comment on table marketing.quota_reservations is
  'Short-lived server-side reservations used to enforce usage quotas atomically across concurrent application instances.';
