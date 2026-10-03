-- A retired sensor the customer no longer wants listed on their Reports
-- page. Decided 2026-10-03.
--
-- Hidden, not deleted: the sensor row and every reading stay, so the
-- record an inspector could ask for is still there, and the admin site
-- still sees everything. Only the Reports page's picker drops it. The
-- check keeps the switch to retired sensors: a live sensor can never be
-- hidden, since hiding one would silently shorten a report.
--
-- Customers set it through the Reports page; the column is added to the
-- one update grant they hold on sensors (20260902 kept it to `name`).
-- The row rule is unchanged: their own sensors only, never a group
-- member's.
--
-- Run in the Supabase SQL editor; ends with a verify.

alter table sensors add column if not exists hidden_at timestamptz;

comment on column sensors.hidden_at is
  'When the customer removed this retired sensor from their Reports page. '
  'Null means listed. Readings are untouched.';

alter table sensors drop constraint if exists sensors_hidden_only_when_retired;
alter table sensors add constraint sensors_hidden_only_when_retired
  check (hidden_at is null or decommissioned_at is not null);

revoke update on table sensors from anon, authenticated;
grant update (name, hidden_at) on table sensors to authenticated;

-- Verify: expect hidden_at and name for UPDATE, nothing else.
select column_name from information_schema.column_privileges
 where table_name = 'sensors' and grantee = 'authenticated' and privilege_type = 'UPDATE'
 order by column_name;
