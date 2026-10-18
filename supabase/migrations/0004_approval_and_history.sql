-- Approval details (reminders already sent, reviewer's note, who submitted, manual vs auto)
-- and a label for each saved version in the history.
alter table emails add column if not exists reminders_sent integer[] not null default '{}';
alter table emails add column if not exists review_note text;
alter table emails add column if not exists submitted_by uuid references auth.users(id);
alter table emails add column if not exists approval_kind text check (approval_kind in ('manual','auto'));
alter table email_versions add column if not exists note text;
create index if not exists emails_status_idx on emails (status, submitted_at);
