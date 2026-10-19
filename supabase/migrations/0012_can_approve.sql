-- Approving is a per-person switch the owner controls (applied by hand).
alter table staff add column if not exists can_approve boolean not null default false;
update staff set can_approve = true where role = 'owner';
