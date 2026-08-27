-- Phase 5 — extend `readings` for Dragino LHT65N / LoRaWAN uplinks.
--
-- Run in the Supabase SQL editor. Safe to re-run (all statements are guarded).
-- Every column is nullable so existing rows and the current ingest path keep
-- working unchanged while Phase 4's parser is built.
--
-- Payload field reference: network-server/UPLINK-FORMAT.md

-- 1. Humidity — `object.Hum_SHT`.
--    The LHT65N reports it alongside temperature; nullable because older rows
--    (and any non-humidity sensor we add later) won't have it.
alter table readings add column if not exists humidity numeric;

-- 2. Battery voltage — `object.BatV`.
--    Deliberately NOT sensors.battery_level: that is a single snapshot in
--    0-100 percent, whereas BatV is volts (e.g. 3.297). Storing volts there
--    would be a silent unit mismatch, and a snapshot cannot give us history.
--    Per-reading values are what let us derive real fleet battery life
--    (rather than trusting Dragino's best-case 8-10 year spec) and alert at
--    the ~2.6 V replace threshold.
alter table readings add column if not exists battery_v numeric;

-- 3. Signal diagnostics — `rxInfo[].rssi` / `rxInfo[].snr` and
--    `txInfo.modulation.lora.spreadingFactor`.
--    Spreading factor is the strongest predictor of battery drain (SF12 costs
--    far more airtime per transmit than SF7), and RSSI/SNR flag poor gateway
--    placement before it becomes packet loss. Added now because backfilling
--    columns onto a forever-growing readings table later is far more painful.
alter table readings add column if not exists rssi integer;
alter table readings add column if not exists snr numeric;
alter table readings add column if not exists spreading_factor smallint;

-- 4. Verify the dedup index rather than re-creating it.
--    DEVLOG records `readings_sensor_time_uniq` on (sensor_id, recorded_at) as
--    already created. Run this and confirm before uncommenting the create.
select indexname, indexdef from pg_indexes where tablename = 'readings';

-- Only if the index above is genuinely missing:
-- create unique index if not exists readings_sensor_time_uniq
--   on readings (sensor_id, recorded_at);

-- Note on RLS/grants: DEVLOG records a table-level `GRANT SELECT ON readings`,
-- so these new columns are covered automatically. If grants were ever narrowed
-- to a column list, they would need re-granting here.
