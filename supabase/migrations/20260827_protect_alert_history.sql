-- Protect alert history from cascade deletion.
--
-- Companion to 20260827_sensor_soft_delete.sql. That migration stopped sensor
-- deletion from destroying readings; this one closes the same class of problem for
-- alert_logs, which is the record that a customer *was* notified when a fridge
-- failed — arguably the most audit-critical row in the schema.
--
-- FK graph before this migration:
--   customers     -> auth.users      NO ACTION
--   gateways      -> customers       CASCADE
--   sensors       -> gateways        CASCADE
--   readings      -> sensors         RESTRICT   (fixed previously)
--   alert_configs -> sensors         CASCADE
--   alert_logs    -> alert_configs   CASCADE    <- alert history lost with config
--   alert_logs    -> readings        CASCADE    <- alert history lost with readings
--
-- Two exposures:
--
-- 1. `alert_logs -> readings CASCADE` is a landmine under the planned data
--    retention job (see TODO.md). Deleting readings older than N would silently
--    delete the alert logs attached to them, erasing the notification record
--    while purging routine data.
--
-- 2. `alert_logs -> alert_configs CASCADE` means deleting a sensor cascades
--    sensor -> alert_configs -> alert_logs. That is currently blocked only
--    incidentally: the same delete also hits readings' RESTRICT and the whole
--    transaction rolls back. A sensor with alert history but no readings would
--    still lose its logs.
--
-- Principle applied: history tables (readings, alert_logs) are never
-- cascade-deleted; configuration tables (alert_configs) may be.
--
-- Run in the Supabase SQL editor.

-- 1. An alert log must outlive the threshold configuration that produced it.
--    Deleting a sensor still cascades into alert_configs, but that cascade now
--    stops here instead of taking the notification record with it.
alter table alert_logs drop constraint if exists alert_logs_alert_config_id_fkey;

alter table alert_logs add constraint alert_logs_alert_config_id_fkey
  foreign key (alert_config_id) references alert_configs(id) on delete restrict;

-- 2. An alert log must outlive the individual reading that triggered it.
--    RESTRICT rather than SET NULL so the future retention job has to be explicit:
--    it must delete alert_logs for the period first, then the readings. A silent
--    SET NULL would orphan the logs and quietly break the link between an alert and
--    the measurement that caused it.
alter table alert_logs drop constraint if exists alert_logs_reading_id_fkey;

alter table alert_logs add constraint alert_logs_reading_id_fkey
  foreign key (reading_id) references readings(id) on delete restrict;

-- Verify the result — every history table should now read RESTRICT.
select
  conrelid::regclass  as child_table,
  confrelid::regclass as parent_table,
  case confdeltype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
  end as on_delete
from pg_constraint
where contype = 'f' and connamespace = 'public'::regnamespace
order by 1;
