-- Feedback from staff using the builder: problems, feature requests, general notes.
-- Written by the server (service role). Only admins can read or triage.
create table feedback (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  email text,
  kind text not null check (kind in ('problem', 'feature', 'feedback')),
  message text not null check (char_length(message) between 3 and 4000),
  context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'seen', 'planned', 'done', 'wont')),
  note text
);
create index on feedback (status, created_at desc);

alter table feedback enable row level security;
create policy feedback_admin_read on feedback for select to authenticated using (bm_role() = 'admin');
create policy feedback_admin_update on feedback for update to authenticated using (bm_role() = 'admin') with check (bm_role() = 'admin');

grant select, update on feedback to authenticated;
revoke all on feedback from anon;
grant all on feedback to service_role;
grant usage, select on sequence feedback_id_seq to authenticated, service_role;
