-- Members serving globally: shown at /serving, edited at /roster.
-- Only the server (service role) reads and writes; no public policies on purpose.
create table public.serving_members (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  who text not null,
  place text not null default '',
  deployed text not null default '',
  note text not null default '',
  photo_url text not null default '',
  hidden boolean not null default false,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.serving_members enable row level security;
revoke all on public.serving_members from anon, authenticated;
grant select, insert, update, delete on public.serving_members to service_role;
