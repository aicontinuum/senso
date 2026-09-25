-- Live schema record, captured 2026-09-23 from the Supabase project's
-- catalog. REFERENCE ONLY — do not run. See README.md in this directory.
--
-- Column lists are as information_schema reported them, before
-- 20260925_branches.sql (which adds gateways.branch_id).

-- ── customers ───────────────────────────────────────────────────────────────
-- id                uuid         not null  default gen_random_uuid()
-- name              text         not null
-- email             text         not null
-- status            text         not null  default 'active'
-- created_at        timestamptz            default now()
-- contact_name      text
-- phone             text
-- auth_user_id      uuid                              ← the link to auth.users
-- alert_recipients  text[]                 default '{}'
-- timezone          text         not null  default 'Asia/Qatar'
-- suspended_at      timestamptz                       ← 20260919_billing.sql

-- ── gateways ────────────────────────────────────────────────────────────────
-- id                 uuid         not null  default gen_random_uuid()
-- customer_id        uuid         not null
-- name               text         not null
-- location           text                             ← unused by either app
-- is_online          boolean                default false
-- last_seen_at       timestamptz
-- created_at         timestamptz            default now()
-- firmware_version   text
-- mac_address        text                             ← LoRaWAN Gateway EUI
-- decommissioned_at  timestamptz

-- ── sensors ─────────────────────────────────────────────────────────────────
-- id                 uuid         not null  default gen_random_uuid()
-- gateway_id         uuid         not null
-- name               text         not null
-- created_at         timestamptz            default now()
-- location           text
-- battery_level      integer
-- status             text         not null  default 'offline'
-- hardware_id        text                             ← LoRaWAN DevEUI
-- decommissioned_at  timestamptz
-- commissioned_at    timestamptz
-- last_reading_at    timestamptz
-- last_reading_id    uuid
-- last_temperature   numeric

-- ── customer_owns_sensor(uuid) ──────────────────────────────────────────────
-- The single ownership test every write rule delegates to. As found it did
-- NOT pin search_path; 20260928_pin_owns_sensor_search_path.sql pins it,
-- body unchanged.
CREATE OR REPLACE FUNCTION public.customer_owns_sensor(sensor_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM sensors s
    JOIN gateways g ON s.gateway_id = g.id
    JOIN customers c ON g.customer_id = c.id
    WHERE s.id = sensor_uuid
      AND c.auth_user_id = auth.uid()
  );
$function$;

-- ── policies ────────────────────────────────────────────────────────────────
-- table     | policy                           | cmd    | roles           | using                                  | with check
-- customers | customers_select_own             | SELECT | {authenticated} | auth.uid() = auth_user_id              |
-- customers | customers_update_own_record      | UPDATE | {public}        | auth_user_id = auth.uid()              | auth_user_id = auth.uid()
-- gateways  | gateways_select_own              | SELECT | {authenticated} | customer_id = (select id from customers where auth_user_id = auth.uid()) |
-- sensors   | customers_update_own_sensor_name | UPDATE | {authenticated} | customer_owns_sensor(id)               | customer_owns_sensor(id)
-- sensors   | customers_update_own_sensors     | UPDATE | {public}        | gateway_id in (select id from gateways where customer_id = (select id from customers where auth_user_id = auth.uid())) |
-- sensors   | sensors_select_own               | SELECT | {authenticated} | gateway_id in (select id from gateways where customer_id = (select id from customers where auth_user_id = auth.uid())) |
--
-- Known issues, already in TODO.md: the two UPDATE policies are row-scoped
-- but not column-scoped (sensors is column-limited by grant since
-- 20260902; customers is not), and both are TO public rather than
-- TO authenticated. sensors carries two UPDATE policies that overlap.

-- ── policies on readings, alert_configs, alert_logs (captured 2026-09-25) ──
-- As found, before 20260927_groups.sql replaced every SELECT rule below.
-- table         | policy                             | cmd    | roles           | using / with check
-- alert_configs | alert_configs_select_own           | SELECT | {authenticated} | sensor_id in (sensors of gateways of the customer whose auth_user_id = auth.uid())
-- alert_configs | customers_read_own_alert_configs   | SELECT | {public}        | same, written as a join
-- alert_configs | customers_select_own_alert_configs | SELECT | {authenticated} | customer_owns_sensor(sensor_id)
-- alert_configs | customers_insert_own_alert_configs | INSERT | {authenticated} | with check customer_owns_sensor(sensor_id)
-- alert_configs | customers_update_own_alert_configs | UPDATE | {authenticated} | customer_owns_sensor(sensor_id)
-- alert_logs    | alert_logs_select_own              | SELECT | {authenticated} | alert_config_id in (configs of the customer's sensors)
--                                                                                 ← reached threshold alerts only; sensor_offline rows (no config) were invisible
-- readings      | customers_select_own_readings      | SELECT | {authenticated} | customer_owns_sensor(sensor_id)
-- readings      | readings_select_own                | SELECT | {authenticated} | sensor_id in (sensors of gateways of the customer)
