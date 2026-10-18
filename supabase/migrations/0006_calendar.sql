-- Email calendar: a planned send time that survives drafts, a recorded sent time,
-- and open slots ministries can reserve before a draft exists.
alter table emails add column if not exists planned_at timestamptz;
alter table emails add column if not exists sent_at timestamptz;
alter table emails add column if not exists sent_marked_by uuid references auth.users(id);
create index if not exists emails_planned_idx on emails (planned_at);
create index if not exists emails_sent_idx on emails (sent_at);

create table if not exists send_slots (
  id uuid primary key default gen_random_uuid(),
  ministry text not null,
  planned_at timestamptz not null,
  label text not null default '',
  note text,
  email_id uuid references emails(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists send_slots_planned_idx on send_slots (planned_at);
alter table send_slots enable row level security;
create policy slots_read on send_slots for select to authenticated using (bm_is_staff());
