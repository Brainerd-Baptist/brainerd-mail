-- Shared "ignore" list for the spelling check: names and church words the whole team has marked as correct.
create table if not exists public.spell_words (
  word text primary key,
  added_by uuid,
  added_at timestamptz not null default now()
);
alter table public.spell_words enable row level security;
