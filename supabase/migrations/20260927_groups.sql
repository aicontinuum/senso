-- Groups: one owner login that sees several accounts.
--
-- A group is a customer row flagged is_group. It owns no devices; instead
-- customer_group_members says which accounts it can see. Every read rule
-- gains one clause, "or this login owns a group the account belongs to",
-- through customer_can_view(); every write rule is untouched, so the owner
-- login can look at a member's sensors, alerts and readings and change none
-- of them. A member account behaves exactly as it did.
--
-- Run block by block in the Supabase SQL editor; each ends with a verify.

-- ── Block 1: the flag, the table, the guards ────────────────────────────────
alter table customers add column if not exists is_group boolean not null default false;

comment on column customers.is_group is
  'An owner login: sees its members'' data, owns no devices of its own.';

create table if not exists customer_group_members (
  group_id   uuid not null references customers(id) on delete cascade,
  member_id  uuid not null references customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, member_id),
  -- An account belongs to at most one group.
  constraint customer_group_members_member_key unique (member_id),
  constraint customer_group_members_not_self check (group_id <> member_id)
);

comment on table customer_group_members is
  'Which accounts an owner login (customers.is_group) may read. Admin-only to change.';

create index if not exists customer_group_members_group_idx on customer_group_members (group_id);

-- Two levels only: a group is never a member, a member is never a group.
create or replace function customer_group_members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from customers where id = new.group_id and is_group) then
    raise exception 'only a group account can have members' using errcode = 'check_violation';
  end if;
  if exists (select 1 from customers where id = new.member_id and is_group) then
    raise exception 'a group cannot be a member of another group' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists customer_group_members_guard on customer_group_members;
create trigger customer_group_members_guard
  before insert or update on customer_group_members
  for each row execute function customer_group_members_guard();

-- A group owns no devices, and the flag cannot flip under a row that
-- depends on it.
create or replace function gateways_group_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from customers where id = new.customer_id and is_group) then
    raise exception 'a group account cannot own a gateway' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists gateways_group_guard on gateways;
create trigger gateways_group_guard
  before insert or update of customer_id on gateways
  for each row execute function gateways_group_guard();

create or replace function customers_group_flag_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_group and not old.is_group then
    if exists (select 1 from gateways where customer_id = new.id) then
      raise exception 'an account with gateways cannot become a group' using errcode = 'check_violation';
    end if;
    if exists (select 1 from customer_group_members where member_id = new.id) then
      raise exception 'a member of a group cannot become a group' using errcode = 'check_violation';
    end if;
  end if;
  if old.is_group and not new.is_group
     and exists (select 1 from customer_group_members where group_id = new.id) then
    raise exception 'remove the members before turning a group back into an account' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists customers_group_flag_guard on customers;
create trigger customers_group_flag_guard
  before update of is_group on customers
  for each row execute function customers_group_flag_guard();

-- Verify: expect the table and three triggers.
select tgname from pg_trigger
 where tgname in ('customer_group_members_guard', 'gateways_group_guard', 'customers_group_flag_guard')
 order by tgname;

-- ── Block 2: who may read an account ────────────────────────────────────────
-- The one question every read rule asks from here on. SECURITY DEFINER so
-- it can look at customers and the membership table whatever the caller's
-- own rights; search_path pinned so it cannot be pointed at a look-alike.
create or replace function customer_can_view(customer_uuid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from customers c
    where c.id = customer_uuid
      and c.auth_user_id = auth.uid()
  ) or exists (
    select 1 from customer_group_members m
    join customers g on g.id = m.group_id
    where m.member_id = customer_uuid
      and g.is_group
      and g.auth_user_id = auth.uid()
  );
$$;

-- The same question asked of a sensor, for the tables that hang off one.
-- customer_owns_sensor() stays as it is and keeps guarding writes.
create or replace function customer_can_view_sensor(sensor_uuid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sensors s
    join gateways g on g.id = s.gateway_id
    where s.id = sensor_uuid
      and customer_can_view(g.customer_id)
  );
$$;

grant execute on function customer_can_view(uuid) to authenticated;
grant execute on function customer_can_view_sensor(uuid) to authenticated;

-- The read rules the repo has the record for, widened. Each is a straight
-- replacement of the policy of the same name.
drop policy if exists customers_select_own on customers;
create policy customers_select_own on customers
  for select to authenticated using (customer_can_view(id));

drop policy if exists gateways_select_own on gateways;
create policy gateways_select_own on gateways
  for select to authenticated using (customer_can_view(customer_id));

drop policy if exists sensors_select_own on sensors;
create policy sensors_select_own on sensors
  for select to authenticated
  using (exists (select 1 from gateways g where g.id = sensors.gateway_id and customer_can_view(g.customer_id)));

drop policy if exists branches_select_own on branches;
create policy branches_select_own on branches
  for select to authenticated using (customer_can_view(customer_id));

drop policy if exists customers_select_own_threshold_history on alert_threshold_history;
create policy customers_select_own_threshold_history on alert_threshold_history
  for select to authenticated
  using (exists (select 1 from alert_configs ac where ac.id = alert_threshold_history.alert_config_id and customer_can_view_sensor(ac.sensor_id)));

drop policy if exists customers_select_own_alert_comments on alert_comments;
create policy customers_select_own_alert_comments on alert_comments
  for select to authenticated
  using (exists (
    select 1 from alert_logs al
    join alert_configs ac on ac.id = al.alert_config_id
    where al.id = alert_comments.alert_log_id and customer_can_view_sensor(ac.sensor_id)
  ));

-- The membership table itself: an owner sees their members, a member sees
-- which group it is in. Writes are admin-only through the service role.
alter table customer_group_members enable row level security;
drop policy if exists customer_group_members_select_own on customer_group_members;
create policy customer_group_members_select_own on customer_group_members
  for select to authenticated using (customer_can_view(member_id));
grant select on table customer_group_members to authenticated;
grant select, insert, delete on table customer_group_members to service_role;

-- Verify: expect the two functions.
select proname from pg_proc where proname in ('customer_can_view', 'customer_can_view_sensor') order by proname;

-- ── Block 3: readings, alert_configs, alert_logs ────────────────────────────
-- Their read rules were written by hand before the repo had migrations
-- (captured 2026-09-25, supabase/baseline). Three things happen here:
-- the rules are widened to the owner login like the rest; the duplicates
-- (three on alert_configs, two on readings, all saying the same thing) are
-- pruned to one each, which TODO.md asked for; and the alert_logs rule,
-- which only reached alerts that have a threshold config and so hid every
-- "stopped reporting" alert from the customer, now covers both kinds.
-- Every write rule on these tables stays exactly as it is.

drop policy if exists alert_configs_select_own on alert_configs;
drop policy if exists customers_read_own_alert_configs on alert_configs;
drop policy if exists customers_select_own_alert_configs on alert_configs;
create policy customers_select_own_alert_configs on alert_configs
  for select to authenticated using (customer_can_view_sensor(sensor_id));

drop policy if exists customers_select_own_readings on readings;
drop policy if exists readings_select_own on readings;
create policy readings_select_own on readings
  for select to authenticated using (customer_can_view_sensor(sensor_id));

drop policy if exists alert_logs_select_own on alert_logs;
create policy alert_logs_select_own on alert_logs
  for select to authenticated
  using (customer_can_view_sensor(
    coalesce(sensor_id, (select ac.sensor_id from alert_configs ac where ac.id = alert_logs.alert_config_id))
  ));

-- Verify: expect exactly one SELECT policy on each of the three.
select tablename, count(*) as select_policies
  from pg_policies
 where tablename in ('alert_configs', 'readings', 'alert_logs') and cmd = 'SELECT'
 group by tablename order by tablename;
