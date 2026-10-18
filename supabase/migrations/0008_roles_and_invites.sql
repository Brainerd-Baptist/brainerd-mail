-- Roles: owner, admin, approver, editor, viewer. Invites. Deactivation.
alter table staff drop constraint if exists staff_role_check;
update staff set role = 'editor' where role = 'leader';
update staff set role = 'owner' where lower(email) = 'jking@brainerdbaptist.org';
alter table staff add constraint staff_role_check check (role in ('owner','admin','approver','editor','viewer'));
alter table staff add column if not exists disabled_at timestamptz;
alter table staff add column if not exists invited_by uuid references auth.users(id);
create unique index if not exists staff_one_owner on staff ((true)) where role = 'owner';

create or replace function bm_can_ministry(m text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff s where s.user_id = auth.uid() and s.disabled_at is null and (s.role in ('owner','admin','approver') or m = any (s.ministries))) $$;
create or replace function bm_is_staff() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff where user_id = auth.uid() and disabled_at is null) $$;

drop policy if exists staff_self on staff;
drop policy if exists staff_admin_write on staff;
create policy staff_self on staff for select to authenticated using (user_id = auth.uid() or bm_role() in ('owner','admin'));
create policy staff_admin_write on staff for all to authenticated using (bm_role() in ('owner','admin')) with check (bm_role() in ('owner','admin'));

drop policy if exists emails_insert on emails;
drop policy if exists emails_update on emails;
drop policy if exists emails_delete on emails;
create policy emails_insert on emails for insert to authenticated with check (bm_role() in ('owner','admin','approver','editor') and bm_can_ministry(ministry));
create policy emails_update on emails for update to authenticated using (bm_role() in ('owner','admin','approver','editor') and bm_can_ministry(ministry)) with check (bm_can_ministry(ministry));
create policy emails_delete on emails for delete to authenticated using (bm_role() in ('owner','admin') or (bm_role() in ('approver','editor') and bm_can_ministry(ministry) and status = 'draft'));

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('admin','approver','editor','viewer')),
  ministries text[] not null default '{}',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_user uuid references auth.users(id),
  revoked_at timestamptz
);
create unique index if not exists invites_one_pending on invites (lower(email)) where accepted_at is null and revoked_at is null;
alter table invites enable row level security;
grant select, insert, update, delete on invites to service_role;

alter table invites add column if not exists first_name text;
alter table invites add column if not exists last_name text;
