-- Branches: one customer, several locations.
--
-- A branch is a grouping on the gateway, not a security boundary. Ownership
-- still resolves sensor → gateway → customer, so every existing policy and
-- customer_owns_sensor() are untouched; a branch only says where a gateway
-- sits so pages can group and label by location. Every customer has at least
-- one: the backfill below creates it, named after the business, and a
-- trigger does the same for every customer created from here on. A customer
-- with a single branch sees nothing new.
--
-- Run block by block in the Supabase SQL editor; each ends with a verify.

-- ── Block 1: the table ──────────────────────────────────────────────────────
create table if not exists branches (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name        text not null,
  address     text,
  created_at  timestamptz not null default now(),
  constraint branches_name_not_blank check (length(trim(name)) > 0)
);

comment on table branches is
  'A customer''s locations. Structure, not history: cascades with its customer, but a gateway must be moved off it before it can go.';
comment on column branches.address is 'Printed on that branch''s reports. Free text.';

create index if not exists branches_customer_idx on branches (customer_id);
-- Two branches of one customer cannot share a name, whatever the case.
create unique index if not exists branches_customer_name_key on branches (customer_id, lower(trim(name)));

-- Verify: expect the table.
select table_name from information_schema.tables where table_name = 'branches';

-- ── Block 2: every customer gets a first branch ─────────────────────────────
-- Existing customers now; new ones by trigger. The name is the business name,
-- which is what a single-site customer would call it anyway.
insert into branches (customer_id, name)
select c.id, c.name from customers c
where not exists (select 1 from branches b where b.customer_id = c.id);

create or replace function customers_default_branch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into branches (customer_id, name) values (new.id, new.name);
  return new;
end $$;

drop trigger if exists customers_default_branch on customers;
create trigger customers_default_branch
  after insert on customers
  for each row execute function customers_default_branch();

-- Verify: expect zero.
select count(*) as customers_without_a_branch
from customers c where not exists (select 1 from branches b where b.customer_id = c.id);

-- ── Block 3: gateways sit in a branch ───────────────────────────────────────
alter table gateways add column if not exists branch_id uuid references branches(id) on delete restrict;

comment on column gateways.branch_id is
  'Where this gateway is installed. Must belong to the gateway''s customer; the guard trigger enforces it.';

-- Point every gateway at its customer's branch. A customer has exactly one
-- at this moment, so the join is unambiguous.
update gateways g set branch_id = b.id
from branches b
where b.customer_id = g.customer_id and g.branch_id is null;

alter table gateways alter column branch_id set not null;

create index if not exists gateways_branch_idx on gateways (branch_id);

-- Verify: expect zero.
select count(*) as gateways_without_a_branch from gateways where branch_id is null;

-- ── Block 4: a branch and its gateway belong to the same customer ───────────
-- Checked on the gateway (insert, and any change of branch or customer) and
-- on the branch (a branch never moves between customers), so no path in
-- admin or the SQL console can cross two customers by mistake.
create or replace function gateways_branch_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  branch_customer uuid;
begin
  select customer_id into branch_customer from branches where id = new.branch_id;
  if branch_customer is null then
    raise exception 'branch % does not exist', new.branch_id using errcode = 'foreign_key_violation';
  end if;
  if branch_customer <> new.customer_id then
    raise exception 'branch belongs to another customer' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists gateways_branch_guard on gateways;
create trigger gateways_branch_guard
  before insert or update of branch_id, customer_id on gateways
  for each row execute function gateways_branch_guard();

create or replace function branches_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id <> old.customer_id then
    raise exception 'a branch cannot move to another customer' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists branches_guard on branches;
create trigger branches_guard
  before update of customer_id on branches
  for each row execute function branches_guard();

-- Verify: expect both triggers.
select tgname from pg_trigger where tgname in ('gateways_branch_guard', 'branches_guard');

-- ── Block 5: access ─────────────────────────────────────────────────────────
-- Customers read their own branches, the same way they read their own
-- gateways. Writes are admin-only through the service role; a customer
-- renaming a branch comes with the customer-side work, not here.
alter table branches enable row level security;

drop policy if exists branches_select_own on branches;
create policy branches_select_own
  on branches
  for select
  to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = branches.customer_id
        and c.auth_user_id = auth.uid()
    )
  );

grant select on table branches to authenticated;
grant select, insert, update, delete on table branches to service_role;

-- Verify: expect the one policy.
select policyname, cmd from pg_policies where tablename = 'branches';
