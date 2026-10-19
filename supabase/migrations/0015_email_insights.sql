-- Cached written summaries for the email report page ("What's happening / working / to try").
create table if not exists public.email_insights (
  email_id uuid primary key references public.emails(id) on delete cascade,
  facts_hash text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.email_insights enable row level security;
grant all on public.email_insights to service_role;
