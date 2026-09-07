-- One live registration per physical device.
--
-- The problem, and it bites exactly when moving a device between customer
-- accounts: `sensors.hardware_id` and `gateways.mac_address` can each hold two
-- rows for the same physical device, because retiring a device is a soft delete
-- and its row stays.
--
-- /api/ingest looks a sensor up by DevEUI filtered to `decommissioned_at is
-- null`, with `maybeSingle()`. Two live rows make that call error, and the code
-- reads the error as "no sensor" — so the reading is **silently dropped** and the
-- log says `unregistered or retired DevEUI`, which is not what happened. You
-- would be standing at the site watching nothing arrive.
--
-- A partial index is the right shape here, not a plain unique constraint. A plain
-- one would also count retired rows, and so would block the legitimate case: a
-- device retired from one customer and registered under another. Registration
-- must be blocked only while another *live* row holds the same identifier.
--
-- Both admin create routes already translate 23505 into "already registered", so
-- the message appears the moment this exists.
--
-- ⚠️ Run the blocks in order. Block 1 tells you whether there is anything to
-- clean up first; it changes nothing.


-- ── Block 1 ── look before touching anything ────────────────────────────────
--
-- (a) Existing unique indexes on these columns. A row with `where` in its
--     definition is already partial and fine. One *without* is a plain unique
--     constraint that would block re-registration after retirement — block 2
--     replaces it.
-- (b) Duplicates that already exist. If either count is non-zero, the index
--     cannot be created until the extra rows are retired: decide which row is
--     the live one and stamp `decommissioned_at` on the others.

select indexname, indexdef
  from pg_indexes
 where tablename in ('sensors', 'gateways')
   and (indexdef ilike '%hardware_id%' or indexdef ilike '%mac_address%')
   and indexdef ilike '%unique%';

select 'sensors' as table_name, hardware_id as identifier, count(*) as live_rows
  from sensors where decommissioned_at is null and hardware_id is not null
 group by hardware_id having count(*) > 1
union all
select 'gateways', mac_address, count(*)
  from gateways where decommissioned_at is null and mac_address is not null
 group by mac_address having count(*) > 1;


-- ── Block 2 ── replace any plain unique constraint with a partial one ───────
--
-- Drops only an index that is unique, on exactly one of these two columns, and
-- has no WHERE clause — i.e. precisely the kind that would refuse a legitimate
-- re-registration. Partial indexes and every other index are left alone. If
-- block 1 showed nothing, this does nothing.

do $$
declare
  victim record;
begin
  for victim in
    select c.relname       as index_name,
           t.relname       as table_name,
           con.conname     as constraint_name
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
      join pg_class t on t.oid = i.indrelid
      join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
      -- A unique index created by `alter table ... add constraint` is owned by
      -- that constraint and cannot be dropped directly; the constraint has to go
      -- instead. Both shapes exist in the wild, so handle both.
      left join pg_constraint con on con.conindid = i.indexrelid
     where t.relname in ('sensors', 'gateways')
       and i.indisunique
       and i.indnatts = 1
       and i.indpred is null                    -- not already partial
       and not i.indisprimary
       and a.attname in ('hardware_id', 'mac_address')
  loop
    if victim.constraint_name is not null then
      raise notice 'dropping plain unique constraint % on % — it would block re-registering a retired device',
        victim.constraint_name, victim.table_name;
      execute format('alter table %I drop constraint %I', victim.table_name, victim.constraint_name);
    else
      raise notice 'dropping plain unique index % on % — it would block re-registering a retired device',
        victim.index_name, victim.table_name;
      execute format('drop index if exists %I', victim.index_name);
    end if;
  end loop;
end $$;


-- ── Block 3 ── one live row per device ──────────────────────────────────────

create unique index if not exists sensors_hardware_id_active
  on sensors (hardware_id)
  where decommissioned_at is null;

create unique index if not exists gateways_mac_address_active
  on gateways (mac_address)
  where decommissioned_at is null;


-- ── Verification — expect both to appear, each with a WHERE clause ──────────
--
--   select indexname, indexdef from pg_indexes
--    where indexname in ('sensors_hardware_id_active', 'gateways_mac_address_active');
