-- Stop sensor deletion from destroying temperature history.
--
-- Problem (verified 2026-08-27): `readings_sensor_id_fkey` was ON DELETE CASCADE,
-- and the admin app hard-deletes sensors — including deleting *every* sensor on a
-- gateway when a gateway is unlinked. One click therefore permanently erased all
-- readings for those sensors, with no warning about readings and no undo. For a
-- compliance product that destroys the exact records the product exists to produce.
--
-- Fix is two-part; this file is the database half. The app half (soft delete
-- instead of hard delete) ships alongside it.
--
-- Run in the Supabase SQL editor.

-- 1. Replace CASCADE with RESTRICT so the database physically refuses to delete a
--    sensor that still has readings attached. This is the guarantee — it holds even
--    if application code regresses, or someone deletes a row by hand in the
--    Supabase table editor.
alter table readings drop constraint if exists readings_sensor_id_fkey;

alter table readings add constraint readings_sensor_id_fkey
  foreign key (sensor_id) references sensors(id) on delete restrict;

-- 2. Soft-delete markers. Retiring a device stamps this instead of deleting the row,
--    so history stays attributable: an auditor asking "what was fridge 3 doing last
--    March?" still resolves to a named sensor.
--
--    Gateways get the same treatment because unlinking a gateway retires all the
--    sensors beneath it — the gateway row has to disappear from dashboards the same
--    way, and deleting it would orphan those still-referenced sensors.
alter table sensors  add column if not exists decommissioned_at timestamptz;
alter table gateways add column if not exists decommissioned_at timestamptz;

-- Partial indexes — the dashboards filter on `decommissioned_at is null` constantly,
-- and retired devices are rare, so these keep those lookups cheap.
create index if not exists sensors_active_idx
  on sensors (gateway_id) where decommissioned_at is null;
create index if not exists gateways_active_idx
  on gateways (customer_id) where decommissioned_at is null;

-- 3. Audit the remaining foreign keys that point at sensors/gateways for the same
--    problem. Of particular interest: alert_configs -> sensors, and
--    alert_logs -> alert_configs. If both cascade, deleting a sensor would also
--    erase its alert history — destroying the proof that someone *was* notified
--    when a fridge failed, which is its own compliance exposure.
--
--    (Step 1 already blocks the common path: a sensor with readings can no longer
--    be deleted at all, so the chain is unreachable for any sensor carrying data.
--    Worth closing properly anyway.)
select
  conrelid::regclass  as referencing_table,
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where confrelid in ('sensors'::regclass, 'gateways'::regclass)
  and contype = 'f';
