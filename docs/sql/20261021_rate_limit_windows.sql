create table if not exists marketing.rate_limit_windows (
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (key_hash, window_start)
);

create index if not exists rate_limit_windows_updated_idx
  on marketing.rate_limit_windows (updated_at);

alter table marketing.rate_limit_windows enable row level security;

comment on table marketing.rate_limit_windows is
  'Server-only fixed-window counters used to enforce rate limits across application instances.';
