-- Owner-scoped business/client workspaces for TrillionAI Marketing.
-- Additive migration. Existing account ownership remains the hard tenant boundary.

create table if not exists marketing.businesses (
  id text primary key,
  owner_id text not null references marketing.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_businesses_owner_created_idx
  on marketing.businesses (owner_id, created_at desc);

alter table marketing.businesses enable row level security;

-- Preserve existing single-business onboarding data as the owner's first business.
insert into marketing.businesses (id, owner_id, data, created_at, updated_at)
select
  'legacy-' || md5(u.id),
  u.id,
  jsonb_strip_nulls(jsonb_build_object(
    'name', nullif(u.profile->>'company', ''),
    'company', nullif(u.profile->>'company', ''),
    'website', nullif(u.profile->>'website', ''),
    'industry', nullif(u.profile->>'industry', ''),
    'companySize', nullif(u.profile->>'companySize', ''),
    'targetAudience', nullif(u.profile->>'targetAudience', ''),
    'primaryOffer', nullif(u.profile->>'primaryOffer', ''),
    'businessDescription', nullif(u.profile->>'businessDescription', ''),
    'primaryGoal', nullif(u.profile->>'primaryGoal', ''),
    'preferredTone', nullif(u.profile->>'preferredTone', ''),
    'legacyProfileImport', true
  )),
  u.created_at,
  now()
from marketing.users u
where coalesce(u.profile->>'company', '') <> ''
  and not exists (
    select 1 from marketing.businesses b where b.owner_id = u.id
  );
