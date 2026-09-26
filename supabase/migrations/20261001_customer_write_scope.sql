-- What a signed-in customer may change, column by column.
--
-- The hand-written rules let a customer update any column of their own
-- row (status included, so a suspended customer could set themselves back
-- to active) and any column of their own alert thresholds, skipping every
-- check the app makes. Row-level rules say which rows; column grants say
-- which columns. This migration adds the column grants and re-scopes the
-- rules from "anyone" to signed-in customers. The app already writes only
-- these columns, so nothing changes on screen.
--
-- Run block by block in the Supabase SQL editor; each ends with a verify.

-- ── Block 1: customers ──────────────────────────────────────────────────────
-- Settings offers contact name, phone, alert recipients and timezone.
-- Nothing else on the row is the customer's to change.
revoke update on table customers from public, anon, authenticated;
grant update (contact_name, phone, alert_recipients, timezone) on table customers to authenticated;

drop policy if exists customers_update_own_record on customers;
create policy customers_update_own_record on customers
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Verify: expect exactly these four columns.
select column_name from information_schema.column_privileges
 where table_name = 'customers' and grantee = 'authenticated' and privilege_type = 'UPDATE'
 order by column_name;

-- ── Block 2: alert thresholds ───────────────────────────────────────────────
-- A customer sets the limit itself and nothing else; the app inserts a
-- config with its sensor, kind and threshold and updates the threshold.
revoke insert, update on table alert_configs from public, anon, authenticated;
grant insert (sensor_id, type, threshold) on table alert_configs to authenticated;
grant update (threshold) on table alert_configs to authenticated;

drop policy if exists customers_update_own_alert_configs on alert_configs;
create policy customers_update_own_alert_configs on alert_configs
  for update to authenticated
  using (customer_owns_sensor(sensor_id))
  with check (customer_owns_sensor(sensor_id));

drop policy if exists customers_insert_own_alert_configs on alert_configs;
create policy customers_insert_own_alert_configs on alert_configs
  for insert to authenticated
  with check (customer_owns_sensor(sensor_id));

-- Verify: expect threshold for UPDATE, and sensor_id, threshold, type for INSERT.
select privilege_type, column_name from information_schema.column_privileges
 where table_name = 'alert_configs' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
 order by privilege_type, column_name;

-- ── Block 3: sensors ────────────────────────────────────────────────────────
-- Two update rules overlapped: the column-scoped rename rule from
-- 20260902, and an older one open to anyone. Permissive rules are OR'd, so
-- the older one was the one in force. Only the rename rule stays.
drop policy if exists customers_update_own_sensors on sensors;

-- Verify: expect the one rename rule.
select policyname, roles from pg_policies where tablename = 'sensors' and cmd = 'UPDATE';
