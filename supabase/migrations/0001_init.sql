-- Brainerd Mail: first schema.
-- Audiences are NOT stored here (ClearStream owns lists). This database holds
-- drafts, send history, tracking, the do-not-email list and the unsubscribe queue.
-- Public routes (click redirect, unsubscribe, web version, prayer button) use the
-- server's service-role key; signed-in staff go through the policies below.

create extension if not exists pgcrypto;

-- Who can use the app and for which ministries
create table staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  role text not null default 'leader' check (role in ('admin','leader','viewer')),
  ministries text[] not null default '{}',
  created_at timestamptz not null default now()
);

create function bm_role() returns text language sql stable security definer set search_path = public as
$$ select role from staff where user_id = auth.uid() $$;

create function bm_can_ministry(m text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff s where s.user_id = auth.uid() and (s.role = 'admin' or m = any (s.ministries))) $$;

create function bm_is_staff() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff where user_id = auth.uid()) $$;

revoke all on function bm_role(), bm_can_ministry(text), bm_is_staff() from public, anon;
grant execute on function bm_role(), bm_can_ministry(text), bm_is_staff() to authenticated;

-- Emails (one row per newsletter)
create table emails (
  id uuid primary key default gen_random_uuid(),
  ministry text not null,
  title text not null,
  doc jsonb not null,
  status text not null default 'draft'
    check (status in ('draft','pending_approval','approved','scheduled','sending','sent','cancelled')),
  channel text not null default 'both' check (channel in ('both','email','text')),
  slug text unique default encode(gen_random_bytes(6), 'hex'), -- the web version address
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scheduled_at timestamptz,          -- when it will go out
  submitted_at timestamptz,          -- when it was sent for approval (starts the 72-hour clock)
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  expedited boolean not null default false  -- under 72 hours: needs explicit approval, never auto-sends
);
create index on emails (ministry, updated_at desc);
create index on emails (status, scheduled_at);

-- Every autosave worth keeping, for history and "start from last email"
create table email_versions (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references emails(id) on delete cascade,
  doc jsonb not null,
  saved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on email_versions (email_id, created_at desc);

-- One row per send attempt (tests and real sends)
create table sends (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references emails(id) on delete cascade,
  kind text not null check (kind in ('test','real')),
  channel text not null check (channel in ('both','email','text')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  counts jsonb not null default '{}'::jsonb  -- audience preview snapshot: both / email only / text only / excluded
);

-- One row per person per send. Holds the address only for the life of the send record.
create table recipients (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references sends(id) on delete cascade,
  email text,
  mobile text,
  channel text not null check (channel in ('email','text')),
  token text not null unique default encode(gen_random_bytes(12), 'hex'), -- identifies them in tracked links
  status text not null default 'queued' check (status in ('queued','sent','delivered','bounced','complained','failed')),
  sent_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz
);
create index on recipients (send_id);

-- Every button and link in an email, so each gets its own count
create table links (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references emails(id) on delete cascade,
  block_id text not null,
  label text not null,
  url text not null,
  unique (email_id, block_id, label, url)
);

create table clicks (
  id bigserial primary key,
  link_id uuid not null references links(id) on delete cascade,
  recipient_id uuid references recipients(id) on delete set null,
  send_id uuid references sends(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email','text','web')),
  device text,                       -- phone / desktop / tablet
  is_bot boolean not null default false, -- link scanners are kept but not counted
  at timestamptz not null default now()
);
create index on clicks (link_id, at);
create index on clicks (send_id);

-- Do-not-email list. Checked before every send, so an unsubscribe takes effect immediately.
create table suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ministry text not null,            -- the ministry whose email they unsubscribed from
  reason text not null default 'unsubscribed' check (reason in ('unsubscribed','bounced','complained','manual')),
  created_at timestamptz not null default now(),
  unique (email, ministry)
);
create index on suppressions (ministry);

-- Staff to-do list: make the matching change in ClearStream by hand
create table unsubscribe_tasks (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ministry text not null,
  requested_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','done')),
  done_by uuid references auth.users(id),
  done_at timestamptz
);
create index on unsubscribe_tasks (status, requested_at);

-- "I'm praying" taps on the web version
create table prays (
  id bigserial primary key,
  issue_slug text not null,
  team_id text not null,
  at timestamptz not null default now()
);
create index on prays (issue_slug, team_id);

-- Who did what (approvals, sends, unsubscribes marked done)
create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid references auth.users(id),
  action text not null,
  email_id uuid references emails(id) on delete set null,
  detail jsonb not null default '{}'::jsonb
);

-- Row level security: staff only, limited to their ministries (admins see everything)
alter table staff enable row level security;
alter table emails enable row level security;
alter table email_versions enable row level security;
alter table sends enable row level security;
alter table recipients enable row level security;
alter table links enable row level security;
alter table clicks enable row level security;
alter table suppressions enable row level security;
alter table unsubscribe_tasks enable row level security;
alter table prays enable row level security;
alter table audit_log enable row level security;

create policy staff_self on staff for select to authenticated using (user_id = auth.uid() or bm_role() = 'admin');
create policy staff_admin_write on staff for all to authenticated using (bm_role() = 'admin') with check (bm_role() = 'admin');

create policy emails_read on emails for select to authenticated using (bm_is_staff() and (bm_role() <> 'leader' or bm_can_ministry(ministry)));
create policy emails_insert on emails for insert to authenticated with check (bm_role() in ('admin','leader') and bm_can_ministry(ministry));
create policy emails_update on emails for update to authenticated using (bm_role() in ('admin','leader') and bm_can_ministry(ministry)) with check (bm_can_ministry(ministry));
create policy emails_delete on emails for delete to authenticated using (bm_role() = 'admin' or (bm_can_ministry(ministry) and status = 'draft'));

create policy versions_read on email_versions for select to authenticated using (exists (select 1 from emails e where e.id = email_id and bm_can_ministry(e.ministry)));
create policy versions_write on email_versions for insert to authenticated with check (exists (select 1 from emails e where e.id = email_id and bm_can_ministry(e.ministry)));

create policy sends_read on sends for select to authenticated using (bm_is_staff() and (bm_role() <> 'leader' or exists (select 1 from emails e where e.id = email_id and bm_can_ministry(e.ministry))));
create policy links_read on links for select to authenticated using (bm_is_staff() and (bm_role() <> 'leader' or exists (select 1 from emails e where e.id = email_id and bm_can_ministry(e.ministry))));
create policy clicks_read on clicks for select to authenticated using (bm_is_staff() and (bm_role() <> 'leader' or exists (select 1 from sends s join emails e on e.id = s.email_id where s.id = send_id and bm_can_ministry(e.ministry))));

-- Individual-level detail (who got it, who clicked) is admin only
create policy recipients_admin on recipients for select to authenticated using (bm_role() = 'admin');

create policy suppressions_read on suppressions for select to authenticated using (bm_is_staff() and (bm_role() <> 'leader' or bm_can_ministry(ministry)));
create policy tasks_read on unsubscribe_tasks for select to authenticated using (bm_is_staff() and (bm_role() <> 'leader' or bm_can_ministry(ministry)));
create policy tasks_done on unsubscribe_tasks for update to authenticated using (bm_role() in ('admin','leader') and bm_can_ministry(ministry)) with check (bm_can_ministry(ministry));
create policy prays_read on prays for select to authenticated using (bm_is_staff());
create policy audit_read on audit_log for select to authenticated using (bm_role() = 'admin');

-- Photos for emails: public read (email apps must load them), uploads go through the server
insert into storage.buckets (id, name, public) values ('email-images', 'email-images', true) on conflict (id) do nothing;

-- Data API access is off by default for new tables, so grant it explicitly.
-- Signed-in staff are limited by the policies above; the server's service role does the rest.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Supabase's automatic-RLS helper should not be callable from the Data API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
