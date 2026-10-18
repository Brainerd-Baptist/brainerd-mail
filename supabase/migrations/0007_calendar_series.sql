-- Repeating emails ("Kids, third Friday of every month"). A series creates real send_slots ahead of
-- time; a slot can be skipped, moved or claimed on its own without touching the rest of the series.
create table if not exists send_series (
  id uuid primary key default gen_random_uuid(),
  ministry text not null,
  label text not null default '',
  kind text not null check (kind in ('nth_weekday','last_weekday','day_of_month','every_n_weeks')),
  weekday smallint check (weekday between 0 and 6),
  nth smallint check (nth between 1 and 4),
  day_of_month smallint check (day_of_month between 1 and 31),
  interval_weeks smallint check (interval_weeks between 1 and 8),
  time_local text not null default '07:00',
  starts_on date not null,
  ends_on date,
  paused boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table send_series enable row level security;
create policy series_read on send_series for select to authenticated using (bm_is_staff());
grant select, insert, update, delete on send_series to service_role;
grant select on send_series to authenticated;

alter table send_slots add column if not exists series_id uuid references send_series(id) on delete set null;
alter table send_slots add column if not exists occurrence_date date;
alter table send_slots add column if not exists skipped boolean not null default false;
alter table send_slots add constraint send_slots_series_occurrence unique (series_id, occurrence_date);
alter table emails add column if not exists series_id uuid references send_series(id) on delete set null;
create index if not exists emails_series_idx on emails (series_id);
