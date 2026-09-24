-- Fixture cases for the branches migration. Runs after fixture.sql and the
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

begin;

-- ── Backfill ────────────────────────────────────────────────────────────────
select assert((select count(*) = 1 from branches where customer_id = '00000000-0000-0000-0000-00000000c0a1'), 'existing customer got one branch');
select assert((select name = 'Fresh Foods' from branches where customer_id = '00000000-0000-0000-0000-00000000c0a1'), 'first branch is named after the business');
select assert((select b.customer_id = g.customer_id from gateways g join branches b on b.id = g.branch_id where g.id = '00000000-0000-0000-0000-00000000900a'), 'existing gateway points at its own customer''s branch');
select assert((select count(*) = 0 from gateways where branch_id is null), 'no gateway is left without a branch');

-- ── New customers ───────────────────────────────────────────────────────────
insert into customers (id, name, email) values ('00000000-0000-0000-0000-00000000c0a3', 'New Shop', 'new@shop.example');
select assert((select count(*) = 1 from branches where customer_id = '00000000-0000-0000-0000-00000000c0a3' and name = 'New Shop'), 'a new customer gets a default branch by trigger');

-- ── Names ───────────────────────────────────────────────────────────────────
insert into branches (customer_id, name, address) values ('00000000-0000-0000-0000-00000000c0a1', 'Lusail', 'Marina Promenade');
select assert((select count(*) = 2 from branches where customer_id = '00000000-0000-0000-0000-00000000c0a1'), 'a second branch can be added');
select assert_raises($q$insert into branches (customer_id, name) values ('00000000-0000-0000-0000-00000000c0a1', '  lusail ')$q$, 'a duplicate name (any case, any spacing) is refused');
select assert_raises($q$insert into branches (customer_id, name) values ('00000000-0000-0000-0000-00000000c0a1', '   ')$q$, 'a blank name is refused');
insert into branches (customer_id, name) values ('00000000-0000-0000-0000-00000000c0a2', 'Lusail');
select assert(true, 'two customers may each have a branch called Lusail');

-- ── Same-customer guard ─────────────────────────────────────────────────────
select assert_raises($q$
  update gateways set branch_id = (select id from branches where customer_id = '00000000-0000-0000-0000-00000000c0a2' and name = 'Lusail')
  where id = '00000000-0000-0000-0000-00000000900a'$q$, 'a gateway cannot be put in another customer''s branch');
select assert_raises($q$
  insert into gateways (customer_id, name, branch_id)
  values ('00000000-0000-0000-0000-00000000c0a1', 'x', (select id from branches where customer_id = '00000000-0000-0000-0000-00000000c0a2' limit 1))$q$,
  'a new gateway cannot be inserted into another customer''s branch');
select assert_raises($q$insert into gateways (customer_id, name) values ('00000000-0000-0000-0000-00000000c0a1', 'x')$q$, 'a new gateway must name a branch');
update gateways set branch_id = (select id from branches where customer_id = '00000000-0000-0000-0000-00000000c0a1' and name = 'Lusail')
where id = '00000000-0000-0000-0000-00000000900a';
select assert((select b.name = 'Lusail' from gateways g join branches b on b.id = g.branch_id where g.id = '00000000-0000-0000-0000-00000000900a'), 'a gateway can move between its own customer''s branches');
select assert_raises($q$update branches set customer_id = '00000000-0000-0000-0000-00000000c0a2' where name = 'Lusail' and customer_id = '00000000-0000-0000-0000-00000000c0a1'$q$, 'a branch cannot move to another customer');

-- ── Deleting ────────────────────────────────────────────────────────────────
select assert_raises($q$delete from branches where customer_id = '00000000-0000-0000-0000-00000000c0a1' and name = 'Lusail'$q$, 'a branch with a gateway cannot be deleted');
delete from branches where customer_id = '00000000-0000-0000-0000-00000000c0a2' and name = 'Lusail';
select assert((select count(*) = 1 from branches where customer_id = '00000000-0000-0000-0000-00000000c0a2'), 'an empty branch can be deleted');

-- ── Access ──────────────────────────────────────────────────────────────────
select assert(has_table_privilege('authenticated', 'branches', 'select'), 'customers can read branches');
select assert(not has_table_privilege('authenticated', 'branches', 'insert') and not has_table_privilege('authenticated', 'branches', 'delete'), 'customers cannot add or remove branches');
select assert(has_column_privilege('authenticated', 'branches', 'alert_recipients', 'update'), 'customers can edit a branch''s recipients');
select assert(not has_column_privilege('authenticated', 'branches', 'name', 'update') and not has_column_privilege('authenticated', 'branches', 'address', 'update') and not has_column_privilege('authenticated', 'branches', 'customer_id', 'update'), 'and nothing else on a branch');
select assert((select alert_recipients = '{}' from branches where customer_id = '00000000-0000-0000-0000-00000000c0a2'), 'a branch starts with no recipients of its own');
select assert(has_table_privilege('service_role', 'branches', 'delete'), 'service_role can manage branches');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select assert((select count(*) = 2 from branches), 'a signed-in customer sees only their own branches');
select assert((select bool_and(customer_id = '00000000-0000-0000-0000-00000000c0a1') from branches), 'and never another customer''s');
update branches set alert_recipients = '{lusail@fresh.example}' where name = 'Lusail';
select assert((select alert_recipients = '{lusail@fresh.example}' from branches where name = 'Lusail'), 'a signed-in customer can set their branch''s recipients');
update branches set alert_recipients = '{x@y.example}' where customer_id = '00000000-0000-0000-0000-00000000c0a2';
reset role;
select assert((select alert_recipients = '{}' from branches where customer_id = '00000000-0000-0000-0000-00000000c0a2'), 'but not another customer''s (the row is invisible, so the update touches nothing)');

rollback;
