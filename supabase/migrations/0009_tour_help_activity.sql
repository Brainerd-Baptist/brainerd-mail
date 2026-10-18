-- Applied live by hand; recorded here so the repo matches the database.
alter table staff add column if not exists tour_done_at timestamptz;
alter table staff add column if not exists last_active_at timestamptz;
-- feedback.kind also allows 'question' (Help sheet "I need help with something").
-- alter table feedback drop constraint feedback_kind_check;
-- alter table feedback add constraint feedback_kind_check check (kind in (<existing kinds>, 'question'));
