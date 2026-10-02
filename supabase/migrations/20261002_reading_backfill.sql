-- Readings recovered from a sensor's own memory after a gap.
--
-- A sensor keeps every reading it takes. When its readings resume after a
-- gap, ingest asks it for the ones it stored meanwhile and files them with
-- the times the sensor took them (apps/admin/lib/ingest/backfill.ts). Such
-- a reading is a reading like any other to the customer: same table, same
-- report, same rules. The flag is for the admin site, so the office can
-- see that a stretch of a record was recovered rather than received live.
--
-- Decided 2026-10-02: no mark on the customer side; stored readings up to
-- two days old are accepted; alerts are untouched (the readings trigger
-- already ignores anything older than the sensor's latest reading).
--
-- Run in the Supabase SQL editor; ends with a verify.

alter table readings add column if not exists backfilled boolean not null default false;

comment on column readings.backfilled is
  'True when recovered from the sensor''s memory after a gap, with the time '
  'the sensor took it. False for a reading received live.';

-- Verify: expect one row, boolean, default false.
select column_name, data_type, column_default
  from information_schema.columns
 where table_name = 'readings' and column_name = 'backfilled';
