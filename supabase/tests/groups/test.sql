-- Fixture cases for the groups migration. Runs after the fixtures and the
-- migration, in one transaction, and rolls back.

\set ON_ERROR_STOP on

create or replace function assert(cond boolean, name text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', name; end if;
  raise notice 'PASS: %', name;
end $$;

create or replace function assert_raises(stmt text, name text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'PASS: % (%)', name, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % (did not raise)', name;
end $$;

-- Signs in as the given auth user for the rest of the transaction.
create or replace function sign_in(auth_uuid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', auth_uuid, true);
$$;

begin;

-- Holdings is the owner login; Fresh Foods and Quiet Cafe (from the
-- branches fixture) become its members; New Shop stays outside.
insert into customers (id, name, email, auth_user_id, is_group) values
  ('00000000-0000-0000-0000-00000000c0b0', 'Holdings', 'owner@holdings.example', '00000000-0000-0000-0000-0000000000b0', true);
insert into customers (id, name, email, auth_user_id) values
  ('00000000-0000-0000-0000-00000000c0a3', 'New Shop', 'new@shop.example', '00000000-0000-0000-0000-0000000000a3');
insert into gateways (id, customer_id, name, mac_address, branch_id)
select '00000000-0000-0000-0000-00000000900c', '00000000-0000-0000-0000-00000000c0a3', 'Shop GW', 'aa00000000000003', id
  from branches where customer_id = '00000000-0000-0000-0000-00000000c0a3';
insert into customer_group_members (group_id, member_id) values
  ('00000000-0000-0000-0000-00000000c0b0', '00000000-0000-0000-0000-00000000c0a1'),
  ('00000000-0000-0000-0000-00000000c0b0', '00000000-0000-0000-0000-00000000c0a2');
insert into sensors (id, gateway_id, name, hardware_id) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000900a', 'Fresh Fridge', 'a8400000000000e1'),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000900c', 'Shop Fridge',  'a8400000000000e3');
insert into readings (id, sensor_id, temperature, recorded_at) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e001', 4.0, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000e003', 4.0, now() - interval '1 hour');
insert into alert_configs (id, sensor_id, type, threshold) values
  ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-00000000e001', 'max', 8),
  ('00000000-0000-0000-0000-00000000ac03', '00000000-0000-0000-0000-00000000e003', 'max', 8);
insert into alert_logs (alert_config_id, reading_id, kind) values
  ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-00000000f001', 'threshold'),
  ('00000000-0000-0000-0000-00000000ac03', '00000000-0000-0000-0000-00000000f003', 'threshold');
insert into alert_logs (sensor_id, kind) values
  ('00000000-0000-0000-0000-00000000e001', 'sensor_offline'),
  ('00000000-0000-0000-0000-00000000e003', 'sensor_offline');

-- ── Structure ───────────────────────────────────────────────────────────────
select assert((select count(*) = 2 from customer_group_members where group_id = '00000000-0000-0000-0000-00000000c0b0'), 'the fixture group has two members');
select assert_raises($q$insert into customer_group_members (group_id, member_id) values ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-00000000c0a3')$q$, 'an ordinary account cannot have members');
select assert_raises($q$insert into customer_group_members (group_id, member_id) values ('00000000-0000-0000-0000-00000000c0b0', '00000000-0000-0000-0000-00000000c0b0')$q$, 'a group cannot be its own member');
insert into customers (id, name, email, is_group) values ('00000000-0000-0000-0000-00000000c0b1', 'Other Holdings', 'x@holdings.example', true);
select assert_raises($q$insert into customer_group_members (group_id, member_id) values ('00000000-0000-0000-0000-00000000c0b0', '00000000-0000-0000-0000-00000000c0b1')$q$, 'a group cannot be a member of another group');
select assert_raises($q$insert into customer_group_members (group_id, member_id) values ('00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-00000000c0a1')$q$, 'an account belongs to at most one group');
select assert_raises($q$insert into gateways (customer_id, name, branch_id) select '00000000-0000-0000-0000-00000000c0b0', 'x', id from branches limit 1$q$, 'a group cannot own a gateway');
select assert_raises($q$update customers set is_group = true where id = '00000000-0000-0000-0000-00000000c0a3'$q$, 'an account with gateways cannot become a group');
select assert_raises($q$update customers set is_group = false where id = '00000000-0000-0000-0000-00000000c0b0'$q$, 'a group with members cannot become an account');
delete from customer_group_members where member_id = '00000000-0000-0000-0000-00000000c0a2';
select assert((select count(*) = 1 from customer_group_members), 'a member can be unlinked');
select assert((select count(*) = 1 from gateways where customer_id = '00000000-0000-0000-0000-00000000c0a2'), 'unlinking leaves the member''s devices alone');

-- ── The owner login reads its members ───────────────────────────────────────
set local role authenticated;
select sign_in('00000000-0000-0000-0000-0000000000b0');
select assert((select count(*) = 2 from customers), 'the owner sees itself and its member');
select assert((select bool_and(id in ('00000000-0000-0000-0000-00000000c0b0', '00000000-0000-0000-0000-00000000c0a1')) from customers), 'and no other account');
select assert((select count(*) = 1 from gateways), 'the owner sees the member''s gateway');
select assert((select count(*) = 1 from sensors), 'and its sensor');
-- Two: the member's, and the group's own default one from the customers trigger.
select assert((select count(*) = 2 from branches), 'and its branches');
select assert((select count(*) = 1 from customer_group_members), 'and the membership itself');
select assert((select count(*) = 1 from readings), 'and its readings');
select assert((select count(*) = 1 from alert_configs), 'and its thresholds');
select assert((select count(*) = 2 from alert_logs), 'and its alerts, both kinds');
update sensors set name = 'Renamed by owner' where id = '00000000-0000-0000-0000-00000000e001';
select assert((select name = 'Fresh Fridge' from sensors where id = '00000000-0000-0000-0000-00000000e001'), 'the owner cannot rename a member''s sensor');
select assert_raises($q$insert into alert_configs (sensor_id, type, threshold) values ('00000000-0000-0000-0000-00000000e001', 'min', 2)$q$, 'the owner cannot add a threshold to a member''s sensor');
reset role;

-- ── A member sees only itself ───────────────────────────────────────────────
set local role authenticated;
select sign_in('00000000-0000-0000-0000-0000000000a1');
select assert((select count(*) = 1 from customers), 'a member still sees only itself');
select assert((select count(*) = 1 from sensors), 'and only its own sensors');
select assert((select count(*) = 1 from readings), 'and only its own readings');
select assert((select count(*) = 2 from alert_logs), 'a member sees its stopped-reporting alert as well as its threshold one');
select assert((select count(*) = 1 from customer_group_members), 'and can see which group it is in');
reset role;

-- ── An outsider sees nothing of the group ───────────────────────────────────
set local role authenticated;
select sign_in('00000000-0000-0000-0000-0000000000a3');
select assert((select count(*) = 1 from customers), 'an outsider sees only itself');
select assert((select count(*) = 0 from customer_group_members), 'and no memberships');
select assert((select count(*) = 1 from readings), 'and only its own readings');
reset role;

-- ── What a customer may change (20261001) ───────────────────────────────────
set local role authenticated;
select sign_in('00000000-0000-0000-0000-0000000000a1');
update customers set contact_name = 'Sara', phone = '+974 5555 0000', timezone = 'Asia/Dubai', alert_recipients = '{ops@fresh.example}'
 where id = '00000000-0000-0000-0000-00000000c0a1';
select assert((select contact_name = 'Sara' and phone = '+974 5555 0000' from customers where id = '00000000-0000-0000-0000-00000000c0a1'), 'a customer can change their own contact details');
select assert_raises($q$update customers set status = 'active' where id = '00000000-0000-0000-0000-00000000c0a1'$q$, 'a customer cannot change their own status');
select assert_raises($q$update customers set name = 'Renamed' where id = '00000000-0000-0000-0000-00000000c0a1'$q$, 'nor their business name');
select assert_raises($q$update customers set email = 'x@y.example' where id = '00000000-0000-0000-0000-00000000c0a1'$q$, 'nor their login email');
update customers set contact_name = 'Intruder' where id = '00000000-0000-0000-0000-00000000c0a3';
insert into alert_configs (sensor_id, type, threshold) values ('00000000-0000-0000-0000-00000000e001', 'min', 2);
select assert((select count(*) = 2 from alert_configs where sensor_id = '00000000-0000-0000-0000-00000000e001'), 'a customer can add a threshold to their own sensor');
update alert_configs set threshold = 9 where sensor_id = '00000000-0000-0000-0000-00000000e001' and type = 'max';
select assert((select threshold = 9 from alert_configs where sensor_id = '00000000-0000-0000-0000-00000000e001' and type = 'max'), 'and change its value');
select assert_raises($q$update alert_configs set email_recipients = '{x@y.example}' where sensor_id = '00000000-0000-0000-0000-00000000e001'$q$, 'but not the config''s recipient list');
select assert_raises($q$update alert_configs set type = 'min' where sensor_id = '00000000-0000-0000-0000-00000000e001' and type = 'max'$q$, 'nor its kind');
select assert_raises($q$update sensors set hardware_id = 'ffffffffffffffff' where id = '00000000-0000-0000-0000-00000000e001'$q$, 'nor a sensor''s device id');
update sensors set name = 'Walk-in' where id = '00000000-0000-0000-0000-00000000e001';
select assert((select name = 'Walk-in' from sensors where id = '00000000-0000-0000-0000-00000000e001'), 'a sensor can still be renamed');
reset role;
set local role authenticated;
select sign_in('00000000-0000-0000-0000-0000000000b0');
update customers set contact_name = 'Owner wrote this' where id = '00000000-0000-0000-0000-00000000c0a1';
select assert((select contact_name = 'Sara' from customers where id = '00000000-0000-0000-0000-00000000c0a1'), 'the owner login cannot change a member''s contact details');
reset role;
-- Checked as the superuser, since the customer cannot see the row they aimed at.
select assert((select contact_name is distinct from 'Intruder' from customers where id = '00000000-0000-0000-0000-00000000c0a3'), 'a customer never changes another customer''s row');
select assert((select count(*) = 1 from pg_policies where tablename = 'sensors' and cmd = 'UPDATE'), 'sensors has one update rule');
select assert((select bool_and('authenticated' = any(roles)) and not bool_or('public' = any(roles)) from pg_policies where tablename in ('customers', 'alert_configs', 'sensors') and cmd in ('UPDATE', 'INSERT')), 'no write rule is open to anyone');

-- ── Grants ──────────────────────────────────────────────────────────────────
select assert(not has_table_privilege('authenticated', 'customer_group_members', 'insert') and not has_table_privilege('authenticated', 'customer_group_members', 'delete'), 'customers cannot change memberships');
select assert(has_table_privilege('service_role', 'customer_group_members', 'delete'), 'service_role can');
select assert((select prosecdef and 'search_path=public' = any(proconfig) from pg_proc where proname = 'customer_can_view'), 'customer_can_view is definer with search_path pinned');
select assert((select prosecdef and 'search_path=public' = any(proconfig) from pg_proc where proname = 'customer_owns_sensor'), 'customer_owns_sensor is definer with search_path pinned');

rollback;
