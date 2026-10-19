-- Cached written summaries for the main Analytics page, one per person-scope + filter combination.
create table if not exists public.analytics_insights (
  key text primary key,
  facts_hash text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.analytics_insights enable row level security;
grant all on public.analytics_insights to service_role;
