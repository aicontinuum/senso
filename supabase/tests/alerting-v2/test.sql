-- Fixture cases for the cutover migration. Every case asserts; any failure
-- raises and aborts the script with the case name.

\set ON_ERROR_STOP on

create or replace function assert(cond boolean, name text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', name; end if;
  raise notice 'PASS: %', name;
end $$;

-- Fixed clock: cases compute times relative to now() but the sweep uses now()
-- too, so all in one transaction is consistent.
begin;

insert into customers (id, name) values ('00000000-0000-0000-0000-00000000c001', 'Test Co');
insert into gateways (id, customer_id) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001');

-- Sensors: healthy, silent-34, silent-36, never-reported-since-commission,
-- uncommissioned, retired-with-open-alerts, threshold-tester.
insert into sensors (id, gateway_id, name, commissioned_at, decommissioned_at) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a001', 'healthy',      now() - interval '2 days', null),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000a001', 'silent34',     now() - interval '2 days', null),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000a001', 'silent36',     now() - interval '2 days', null),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000a001', 'neverheard',   now() - interval '40 minutes', null),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000a001', 'uncommissioned', null, null),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000a001', 'retired',      now() - interval '2 days', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000a001', 'fridge',       now() - interval '2 days', null);

-- Limits on the fridge: 2..8 °C, plus an inactive limit that must be ignored.
insert into alert_configs (id, sensor_id, type, threshold, is_active) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000007', 'min', 2, true),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000007', 'max', 8, true),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000007', 'max', 4, false);
-- Limit on the retired sensor, with a breach still open from before retirement.
insert into alert_configs (id, sensor_id, type, threshold) values
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000006', 'max', 8);
insert into alert_logs (kind, alert_config_id, triggered_at, is_resolved)
  values ('threshold', '00000000-0000-0000-0000-0000000000f6', now() - interval '3 hours', false);
insert into alert_logs (kind, sensor_id, triggered_at, is_resolved)
  values ('sensor_offline', '00000000-0000-0000-0000-000000000006', now() - interval '2 hours', false);

-- Readings drive the stamps through the trigger.
insert into readings (sensor_id, temperature, recorded_at) values
  ('00000000-0000-0000-0000-000000000001', 4, now() - interval '5 minutes'),
  ('00000000-0000-0000-0000-000000000002', 4, now() - interval '34 minutes'),
  ('00000000-0000-0000-0000-000000000003', 4, now() - interval '36 minutes'),
  ('00000000-0000-0000-0000-000000000007', 4, now() - interval '30 minutes');

-- ── Trigger: snapshot ────────────────────────────────────────────────────────
select assert((select last_temperature = 4 and status = 'online' from sensors where name = 'healthy'), 'trigger stamps snapshot and status');

-- An older reading arriving late must not move the stamp back.
insert into readings (sensor_id, temperature, recorded_at) values ('00000000-0000-0000-0000-000000000001', 9, now() - interval '50 minutes');
select assert((select last_temperature = 4 from sensors where name = 'healthy'), 'late old reading does not move the stamp');
select assert((select count(*) = 0 from alert_logs where kind = 'threshold' and alert_config_id in (select id from alert_configs where sensor_id = '00000000-0000-0000-0000-000000000001')), 'late old reading judges nothing');

-- ── Trigger: thresholds ─────────────────────────────────────────────────────
-- In range: nothing.
select assert((select count(*) = 0 from alert_logs where alert_config_id in ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f3')), 'in-range reading opens nothing');

-- 5 °C is over the *inactive* 4 °C max: must not open.
insert into readings (sensor_id, temperature, recorded_at) values ('00000000-0000-0000-0000-000000000007', 5, now() - interval '25 minutes');
select assert((select count(*) = 0 from alert_logs where alert_config_id = '00000000-0000-0000-0000-0000000000f3'), 'inactive limit is ignored');

-- 9 °C breaches the 8 °C max: exactly one open alert, triggered at the reading time.
insert into readings (sensor_id, temperature, recorded_at) values ('00000000-0000-0000-0000-000000000007', 9, now() - interval '20 minutes');
select assert((select count(*) = 1 from alert_logs where alert_config_id = '00000000-0000-0000-0000-0000000000f2' and is_resolved = false), 'breach opens one alert');
select assert((select triggered_at = now() - interval '20 minutes' from alert_logs where alert_config_id = '00000000-0000-0000-0000-0000000000f2'), 'breach triggered_at is the reading time');

-- Still breaching: still exactly one, not two.
insert into readings (sensor_id, temperature, recorded_at) values ('00000000-0000-0000-0000-000000000007', 10, now() - interval '15 minutes');
select assert((select count(*) = 1 from alert_logs where alert_config_id = '00000000-0000-0000-0000-0000000000f2'), 'continued breach does not open a second');

-- A backdated in-range reading (older than the stamp) must NOT resolve it.
insert into readings (sensor_id, temperature, recorded_at) values ('00000000-0000-0000-0000-000000000007', 4, now() - interval '18 minutes');
select assert((select is_resolved = false from alert_logs where alert_config_id = '00000000-0000-0000-0000-0000000000f2'), 'backdated in-range reading does not resolve an open breach');

-- A fresh in-range reading resolves it, with resolved_at = reading time.
insert into readings (sensor_id, temperature, recorded_at) values ('00000000-0000-0000-0000-000000000007', 6, now() - interval '10 minutes');
select assert((select is_resolved = true and resolved_at = now() - interval '10 minutes' from alert_logs where alert_config_id = '00000000-0000-0000-0000-0000000000f2'), 'fresh in-range reading resolves with resolved_at');

-- Too cold: min limit opens.
insert into readings (sensor_id, temperature, recorded_at) values ('00000000-0000-0000-0000-000000000007', 1, now() - interval '5 minutes');
select assert((select count(*) = 1 from alert_logs where alert_config_id = '00000000-0000-0000-0000-0000000000f1' and is_resolved = false), 'min breach opens');

-- Uncommissioned sensor: reading stored, stamped, but no alert even if breaching.
insert into alert_configs (id, sensor_id, type, threshold) values ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000005', 'max', 8);
insert into readings (sensor_id, temperature, recorded_at) values ('00000000-0000-0000-0000-000000000005', 25, now() - interval '1 minute');
select assert((select last_temperature = 25 from sensors where name = 'uncommissioned'), 'uncommissioned reading still stamps');
select assert((select count(*) = 0 from alert_logs where alert_config_id = '00000000-0000-0000-0000-0000000000f5'), 'uncommissioned sensor raises nothing');

-- ── Dedup ───────────────────────────────────────────────────────────────────
insert into readings (sensor_id, temperature, recorded_at, dedup_id) values ('00000000-0000-0000-0000-000000000001', 4, now() - interval '4 minutes', 'dup-1');
do $$ begin
  insert into readings (sensor_id, temperature, recorded_at, dedup_id) values ('00000000-0000-0000-0000-000000000001', 4, now() - interval '3 minutes', 'dup-1');
  raise exception 'FAIL: duplicate dedup_id was accepted';
exception when unique_violation then raise notice 'PASS: duplicate dedup_id refused';
end $$;

-- ── Sweep, platform down ────────────────────────────────────────────────────
update platform_status set vps_last_seen_at = now() - interval '11 minutes', chirpstack_ok = true;
select assert(platform_is_down(), 'platform_is_down: stale pulse');
select assert((select sweep_offline_sensors() ->> 'skipped') = 'platform_down', 'sweep holds while platform down');
select assert((select count(*) = 0 from alert_logs where kind = 'sensor_offline' and sensor_id <> '00000000-0000-0000-0000-000000000006'), 'held sweep opened nothing');
update platform_status set vps_last_seen_at = now(), chirpstack_ok = false;
select assert(platform_is_down(), 'platform_is_down: chirpstack not answering');
update platform_status set vps_last_seen_at = now(), chirpstack_ok = true;
select assert(not platform_is_down(), 'platform_is_down: healthy');

-- ── Sweep, platform up ──────────────────────────────────────────────────────
select sweep_offline_sensors() as first_sweep \gset
select assert((:'first_sweep'::jsonb ->> 'sensorsOffline')::int = 2, 'sweep opens silent36 and neverheard, not silent34');
select assert((select count(*) = 1 from alert_logs where kind = 'sensor_offline' and sensor_id = '00000000-0000-0000-0000-000000000003' and is_resolved = false), 'silent36 opened');
select assert((select triggered_at = now() - interval '36 minutes' from alert_logs where kind = 'sensor_offline' and sensor_id = '00000000-0000-0000-0000-000000000003'), 'offline triggered_at is the last reading time');
select assert((select count(*) = 1 from alert_logs where kind = 'sensor_offline' and sensor_id = '00000000-0000-0000-0000-000000000004' and is_resolved = false), 'never-heard sensor opened from commissioned_at');
select assert((select count(*) = 0 from alert_logs where kind = 'sensor_offline' and sensor_id = '00000000-0000-0000-0000-000000000002'), 'silent34 not opened');
select assert((select count(*) = 0 from alert_logs where kind = 'sensor_offline' and sensor_id = '00000000-0000-0000-0000-000000000005'), 'uncommissioned not opened');
select assert((select is_resolved from alert_logs where kind = 'sensor_offline' and sensor_id = '00000000-0000-0000-0000-000000000006'), 'retired sensor offline alert closed');
select assert((select is_resolved from alert_logs where alert_config_id = '00000000-0000-0000-0000-0000000000f6'), 'retired sensor stranded threshold alert closed');
select assert((:'first_sweep'::jsonb ->> 'strandedAlertsClosed')::int = 1, 'stranded count reported');
select assert((select count(*) >= 1 from job_runs where job = 'sweep' and ok), 'sweep recorded in job_runs');
select assert((select sweep_last_ok_at > now() - interval '1 minute' from platform_status), 'sweep stamped platform_status');

-- Idempotent: a second sweep opens nothing new.
select assert((select (sweep_offline_sensors() ->> 'sensorsOffline')::int = 0), 'second sweep opens nothing');

-- Recovery: silent36 reports again → next sweep closes its alert.
insert into readings (sensor_id, temperature, recorded_at) values ('00000000-0000-0000-0000-000000000003', 4, now() - interval '30 seconds');
select assert((select (sweep_offline_sensors() ->> 'offlineClosed')::int = 1), 'recovered sensor closed');
select assert((select resolved_at is not null from alert_logs where kind = 'sensor_offline' and sensor_id = '00000000-0000-0000-0000-000000000003'), 'recovery stamps resolved_at');

rollback;
