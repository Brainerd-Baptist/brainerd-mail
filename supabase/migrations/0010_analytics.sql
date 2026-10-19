-- Analytics: estimated opens, web-version views, and which send an unsubscribe came from. Applied live by hand.
create table if not exists opens (
  id bigserial primary key,
  recipient_id uuid references recipients(id) on delete cascade,
  send_id uuid references sends(id) on delete cascade,
  at timestamptz not null default now(),
  device text,
  is_proxy boolean not null default false
);
create table if not exists web_views (
  id bigserial primary key,
  email_id uuid references emails(id) on delete cascade,
  at timestamptz not null default now(),
  device text,
  is_bot boolean not null default false
);
alter table opens enable row level security;
alter table web_views enable row level security;
grant all on opens, web_views to service_role;
grant usage, select on sequence opens_id_seq, web_views_id_seq to service_role;
create index if not exists opens_send_idx on opens (send_id);
create index if not exists web_views_email_idx on web_views (email_id, at);
alter table suppressions add column if not exists send_id uuid references sends(id) on delete set null;
