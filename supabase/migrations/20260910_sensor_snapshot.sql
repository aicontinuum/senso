-- Phase 1 of Alerting v2: the sensor row carries its own freshness.
--
-- Until now "when did this sensor last report" was rebuilt every time anyone
-- asked, by scanning `readings` for rows newer than a cutoff and treating any
-- sensor *absent* from the answer as silent. On 2026-09-09 that query came back
-- empty a few times overnight and the alert sweep concluded the fleet had gone
-- quiet, emailing a customer four times about a sensor that never missed a beat.
--
-- A conclusion drawn from not finding something cannot tell a true negative from
-- a failed lookup. So the fact moves onto the row: every stored reading stamps
-- its sensor, in the same transaction, and staleness becomes a comparison
-- against a timestamp that is either there or not. Nothing reads these columns
-- yet — this migration is additive and safe to apply on its own.
--
-- Run block by block. Each ends in a verification query.


-- ── Block 1: the snapshot columns ───────────────────────────────────────────

alter table sensors
  add column if not exists last_reading_at  timestamptz,
  add column if not exists last_reading_id  uuid references readings(id) on delete restrict,
  add column if not exists last_temperature numeric;

comment on column sensors.last_reading_at is
  'recorded_at of the newest stored reading. Maintained by readings_after_insert; '
  'only ever moves forward. The single source of truth for "is this sensor reporting".';
comment on column sensors.last_reading_id is
  'The reading last_reading_at came from.';
comment on column sensors.last_temperature is
  'Temperature of that reading, so the dashboard need not fetch it separately.';

-- Verify: expect three rows.
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'sensors'
   and column_name in ('last_reading_at', 'last_reading_id', 'last_temperature');


-- ── Block 2: the trigger ────────────────────────────────────────────────────
--
-- Guarded on recorded_at so a late-arriving *older* reading (a ChirpStack retry,
-- a backfill) can never move a sensor backwards in time. Ties are ignored too:
-- the unique index on (sensor_id, recorded_at) means a tie is the same reading.

create or replace function readings_after_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update sensors
     set last_reading_at  = new.recorded_at,
         last_reading_id  = new.id,
         last_temperature = new.temperature
   where id = new.sensor_id
     and (last_reading_at is null or last_reading_at < new.recorded_at);
  return new;
end;
$$;

drop trigger if exists readings_stamp_sensor on readings;
create trigger readings_stamp_sensor
  after insert on readings
  for each row execute function readings_after_insert();

-- Verify: expect one row.
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'readings'::regclass and tgname = 'readings_stamp_sensor';


-- ── Block 3: backfill from history ──────────────────────────────────────────
--
-- One pass over readings, newest per sensor. Safe to re-run: the guard in the
-- where clause makes it a no-op for any sensor already stamped correctly.

with latest as (
  select distinct on (sensor_id)
         sensor_id, id, recorded_at, temperature
    from readings
   order by sensor_id, recorded_at desc
)
update sensors s
   set last_reading_at  = l.recorded_at,
       last_reading_id  = l.id,
       last_temperature = l.temperature
  from latest l
 where l.sensor_id = s.id
   and (s.last_reading_at is null or s.last_reading_at < l.recorded_at);

-- Verify: expect zero rows. Any row here is a sensor whose snapshot disagrees
-- with its readings, which would mean the backfill or the trigger is wrong.
select s.id, s.last_reading_at, max(r.recorded_at) as newest_reading
  from sensors s
  join readings r on r.sensor_id = s.id
 group by s.id, s.last_reading_at
having s.last_reading_at is distinct from max(r.recorded_at);


-- ── Notes ───────────────────────────────────────────────────────────────────
--
-- Grants: customers already hold a table-level SELECT on sensors through their
-- own-rows policy, so the new columns are readable to them automatically. The
-- column-scoped UPDATE grant from 20260902_sensor_commissioning.sql is
-- untouched: customers still cannot write anything but `name`, and these
-- columns are written only by the trigger.
--
-- Nothing in the application reads these columns until phase 4. Until then the
-- verification in Block 3 can be re-run at any time to confirm the trigger is
-- keeping pace with ingest.
