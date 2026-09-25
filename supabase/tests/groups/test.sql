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
update sensors set name = 'Renamed by owner' where id = '00000000-0000-0000-0000-00000000e001';
select assert((select name = 'Fresh Fridge' from sensors where id = '00000000-0000-0000-0000-00000000e001'), 'the owner cannot rename a member''s sensor');
reset role;

-- ── A member sees only itself ───────────────────────────────────────────────
set local role authenticated;
select sign_in('00000000-0000-0000-0000-0000000000a1');
select assert((select count(*) = 1 from customers), 'a member still sees only itself');
select assert((select count(*) = 1 from sensors), 'and only its own sensors');
select assert((select count(*) = 1 from customer_group_members), 'and can see which group it is in');
reset role;

-- ── An outsider sees nothing of the group ───────────────────────────────────
set local role authenticated;
select sign_in('00000000-0000-0000-0000-0000000000a3');
select assert((select count(*) = 1 from customers), 'an outsider sees only itself');
select assert((select count(*) = 0 from customer_group_members), 'and no memberships');
reset role;

-- ── Grants ──────────────────────────────────────────────────────────────────
select assert(not has_table_privilege('authenticated', 'customer_group_members', 'insert') and not has_table_privilege('authenticated', 'customer_group_members', 'delete'), 'customers cannot change memberships');
select assert(has_table_privilege('service_role', 'customer_group_members', 'delete'), 'service_role can');
select assert((select prosecdef and 'search_path=public' = any(proconfig) from pg_proc where proname = 'customer_can_view'), 'customer_can_view is definer with search_path pinned');

rollback;
