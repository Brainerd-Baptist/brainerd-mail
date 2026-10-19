-- Sending safeguards and ClearStream audience checks (applied by hand; kept here as the record).
create table if not exists mail_settings (
  id int primary key default 1 check (id = 1),
  send_mode text not null default 'off' check (send_mode in ('off','staff','live')),
  safe_list text[] not null default '{}',
  live_cap int not null default 25 check (live_cap between 1 and 5000),
  auto_send boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table if not exists audience_lists (
  ministry text primary key,
  list_id text not null,
  list_name text not null default '',
  expected int,
  updated_at timestamptz not null default now()
);
create table if not exists audience_snapshots (
  id bigserial primary key,
  ministry text not null,
  taken_at timestamptz not null default now(),
  taken_by uuid references auth.users(id),
  list_id text not null,
  total int not null default 0,
  email_ok int not null default 0,
  text_ok int not null default 0,
  members jsonb not null default '[]'::jsonb
);
create index if not exists audience_snapshots_idx on audience_snapshots (ministry, taken_at desc);
alter table mail_settings enable row level security;
alter table audience_lists enable row level security;
alter table audience_snapshots enable row level security;
grant all on mail_settings, audience_lists, audience_snapshots to service_role;
grant usage, select on sequence audience_snapshots_id_seq to service_role;
insert into mail_settings (id, send_mode, safe_list) values (1, 'off', array['jking@brainerdbaptist.org']) on conflict (id) do nothing;
