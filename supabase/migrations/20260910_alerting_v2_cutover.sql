-- Phase 4 of Alerting v2: the database decides.
--
-- After this migration no alert is opened or closed outside PostgreSQL.
--
--   * A threshold breach is judged by the trigger that stores the reading, in
--     the same transaction, against the sensor's active limits — "the rule is
--     inside the filing cabinet". A reading cannot exist without its verdict,
--     and every future path that inserts a reading gets the verdict for free.
--   * A silent sensor is found by one SQL statement on `sensors`, scheduled by
--     pg_cron, reading only the `last_reading_at` stamp. There is no readings
--     scan, no row limit, and no network between the question and the answer,
--     so the failure of 2026-09-09 — an empty query answer mistaken for a
--     silent fleet — has no shape to take.
--   * Both hold while the platform's own pulse says it is down, so an outage on
--     our side never reaches a customer as their fridge.
--
-- The application side of this phase (deployed with it): /api/ingest stops
-- evaluating thresholds and gains a six-hour lower bound and ChirpStack
-- deduplication; /api/cron/alerts loses its sweep and only sends.
--
-- Verified against a real PostgreSQL 16 with a fixture of the live schema:
-- see DEVLOG 2026-09-10. Run block by block; each ends in a verification.


-- ── Block 1: deduplication on ChirpStack's own id ───────────────────────────
--
-- ChirpStack sends `deduplicationId` on every uplink event. A retry carries the
-- same id, so it can be refused by index rather than by trusting the timestamp
-- to match. Partial: readings that predate this column stay null.

alter table readings add column if not exists dedup_id text;

create unique index if not exists readings_dedup_id_uniq
  on readings (dedup_id) where dedup_id is not null;

comment on column readings.dedup_id is
  'ChirpStack deduplicationId. Unique where present; an HTTP retry with the '
  'same id is refused at the index.';

-- Verify: expect one row.
select indexname from pg_indexes where indexname = 'readings_dedup_id_uniq';


-- ── Block 2: is the platform down? ──────────────────────────────────────────
--
-- The same two direct signals the admin card uses, with the same thresholds
-- as apps/admin/lib/constants.ts (VPS_PULSE_STALE_MS). Keep them in step.
-- Down means: the VPS has not pulsed inside ten minutes, or its last pulse
-- reported ChirpStack not answering. The uplink stamp is deliberately not a
-- signal here — with a small fleet it trails by a whole reading interval.

create or replace function platform_is_down()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select vps_last_seen_at is null
         or vps_last_seen_at < now() - interval '10 minutes'
         or chirpstack_ok is false
       from platform_status where id = true),
    true);
$$;

comment on function platform_is_down() is
  'True when the VPS pulse is stale or reported ChirpStack down. While true, '
  'the sweep raises nothing and the sender holds.';

-- Verify: expect false right now (the VPS is pulsing).
select platform_is_down();


-- ── Block 3: the trigger judges the reading ─────────────────────────────────
--
-- Replaces the phase-1 trigger body. Order matters:
--   1. Stamp the sensor — only if this reading is newer than the stamp.
--   2. If it was not newer, stop. A late-arriving old reading must never
--      re-judge the present: it can neither open a breach that has since
--      cleared nor clear one that is still open.
--   3. If the sensor is not commissioned, stop. Bench readings are stored but
--      raise nothing (see 20260902_sensor_commissioning.sql).
--   4. For each active limit: breaching → open one alert (the partial unique
--      index makes a second open impossible, so a concurrent insert is a
--      harmless no-op); in range → close whatever is open.
--
-- `is_active` is honoured. The previous TypeScript evaluation ignored it.

create or replace function readings_after_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  stamped     boolean;
  in_service  boolean;
  cfg         record;
begin
  update sensors
     set last_reading_at  = new.recorded_at,
         last_reading_id  = new.id,
         last_temperature = new.temperature,
         status           = 'online'
   where id = new.sensor_id
     and (last_reading_at is null or last_reading_at < new.recorded_at)
  returning commissioned_at is not null and decommissioned_at is null
       into in_service;

  stamped := found;
  if not stamped or not in_service then
    return new;
  end if;

  for cfg in
    select id, type, threshold
      from alert_configs
     where sensor_id = new.sensor_id
       and coalesce(is_active, true)
  loop
    if (cfg.type = 'min' and new.temperature < cfg.threshold)
       or (cfg.type = 'max' and new.temperature > cfg.threshold) then
      insert into alert_logs (kind, alert_config_id, reading_id, triggered_at, is_resolved)
      values ('threshold', cfg.id, new.id, new.recorded_at, false)
      on conflict (alert_config_id) where is_resolved = false and alert_config_id is not null
      do nothing;
    else
      update alert_logs
         set is_resolved = true, resolved_at = new.recorded_at
       where alert_config_id = cfg.id and is_resolved = false;
    end if;
  end loop;

  return new;
end;
$$;

-- The trigger itself already exists from phase 1 and points at this function
-- by name, so replacing the body is enough. Verify: expect one enabled row.
select tgname, tgenabled from pg_trigger
 where tgrelid = 'readings'::regclass and tgname = 'readings_stamp_sensor';


-- ── Block 4: the sweep finds silence ────────────────────────────────────────
--
-- One function, four statements, all on `sensors` and `alert_logs`:
--   open    — in service and provably silent by its own stamp (or never heard
--             from since commissioning). triggered_at is the true start of the
--             silence, not "now minus the window".
--   close   — reported inside the window, or no longer in service.
--   strand  — a retired or uncommissioned sensor's open *threshold* alert,
--             which ingest can no longer clear because it stores no readings
--             for it. Closes the case in TODO.md "Alerting — added 2026-09-09".
--   record  — one job_runs row and the platform stamp, so the card and the
--             ledger see this run exactly as they saw the TypeScript one.
--
-- Guarded first: while the platform is down every sensor looks silent for our
-- reasons, not theirs. Raise nothing, close nothing, say why, return.
--
-- The 35-minute window matches SENSOR_STALE_MS in packages/status. Keep in step.

create or replace function sweep_offline_sensors()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  started   timestamptz := clock_timestamp();
  cutoff    timestamptz := now() - interval '35 minutes';
  opened    integer := 0;
  closed    integer := 0;
  stranded  integer := 0;
  result    jsonb;
begin
  if platform_is_down() then
    result := jsonb_build_object('skipped', 'platform_down');
    insert into job_runs (job, started_at, finished_at, ok, detail)
    values ('sweep', started, clock_timestamp(), true, result);
    return result;
  end if;

  with ins as (
    insert into alert_logs (kind, sensor_id, triggered_at, is_resolved)
    select 'sensor_offline', s.id, coalesce(s.last_reading_at, s.commissioned_at), false
      from sensors s
     where s.decommissioned_at is null
       and s.commissioned_at is not null
       and coalesce(s.last_reading_at, s.commissioned_at) < cutoff
    on conflict (sensor_id) where is_resolved = false and kind = 'sensor_offline'
    do nothing
    returning 1
  )
  select count(*) into opened from ins;

  with upd as (
    update alert_logs a
       set is_resolved = true, resolved_at = now()
      from sensors s
     where a.sensor_id = s.id
       and a.kind = 'sensor_offline'
       and a.is_resolved = false
       and (s.last_reading_at >= cutoff
            or s.decommissioned_at is not null
            or s.commissioned_at is null)
    returning 1
  )
  select count(*) into closed from upd;

  with upd as (
    update alert_logs a
       set is_resolved = true, resolved_at = now()
      from alert_configs c
      join sensors s on s.id = c.sensor_id
     where a.alert_config_id = c.id
       and a.kind = 'threshold'
       and a.is_resolved = false
       and (s.decommissioned_at is not null or s.commissioned_at is null)
    returning 1
  )
  select count(*) into stranded from upd;

  result := jsonb_build_object(
    'sensorsOffline', opened, 'offlineClosed', closed, 'strandedAlertsClosed', stranded);

  insert into job_runs (job, started_at, finished_at, ok, detail)
  values ('sweep', started, clock_timestamp(), true, result);

  update platform_status set sweep_last_ok_at = clock_timestamp() where id = true;

  return result;
end;
$$;

-- Nobody but the scheduler and the service role may call these.
revoke all on function platform_is_down() from public;
revoke all on function sweep_offline_sensors() from public;
grant execute on function platform_is_down() to service_role;
grant execute on function sweep_offline_sensors() to service_role;

-- Verify: run it once by hand. Expect a jsonb like
-- {"sensorsOffline": 0, "offlineClosed": 0, "strandedAlertsClosed": 0}
-- and a new row in job_runs with job = 'sweep'.
select sweep_offline_sensors();


-- ── Block 5: schedule it ────────────────────────────────────────────────────
--
-- Every five minutes, offset by one so it never lands on the same second as
-- the sender (which runs at :00, :05, ... from the VPS until phase 5).

select cron.schedule('sweep-offline', '1-59/5 * * * *', 'select sweep_offline_sensors()');

-- Verify: expect one active row.
select jobname, schedule, active from cron.job where jobname = 'sweep-offline';

-- Then deploy the application. Until it is deployed the old TypeScript sweep
-- runs beside this one; both are idempotent through the unique indexes, so the
-- overlap is harmless.
