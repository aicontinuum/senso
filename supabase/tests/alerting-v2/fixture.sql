-- Fixture of the live schema as of 2026-09-10, reconstructed from the
-- information_schema dump the user pasted plus the repo's migrations. Only what
-- the cutover migration touches or reads. Not the real thing; close enough to
-- prove the trigger and the sweep against a real PostgreSQL 16.

create extension if not exists pgcrypto;

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alert_recipients text[] default '{}'
);

create table gateways (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  mac_address text,
  is_online boolean default false,
  last_seen_at timestamptz,
  decommissioned_at timestamptz
);

create table sensors (
  id uuid primary key default gen_random_uuid(),
  gateway_id uuid not null references gateways(id),
  name text not null,
  created_at timestamptz default now(),
  location text,
  battery_level integer,
  status text not null default 'offline',
  hardware_id text,
  decommissioned_at timestamptz,
  commissioned_at timestamptz,
  last_reading_at timestamptz,
  last_reading_id uuid,
  last_temperature numeric
);

create table readings (
  id uuid primary key default gen_random_uuid(),
  sensor_id uuid not null references sensors(id) on delete restrict,
  temperature numeric not null,
  recorded_at timestamptz default now(),
  humidity numeric,
  battery_v numeric,
  rssi integer,
  snr numeric,
  spreading_factor smallint
);
create unique index readings_sensor_time_uniq on readings (sensor_id, recorded_at);
alter table sensors add constraint sensors_last_reading_id_fkey
  foreign key (last_reading_id) references readings(id) on delete restrict;

create table alert_configs (
  id uuid primary key default gen_random_uuid(),
  sensor_id uuid not null references sensors(id),
  type text not null,
  threshold numeric not null,
  email_recipients text[] not null default '{}',
  is_active boolean default true,
  created_at timestamptz default now()
);

create type alert_kind as enum ('threshold', 'sensor_offline', 'gateway_offline');

create table alert_logs (
  id uuid primary key default gen_random_uuid(),
  alert_config_id uuid references alert_configs(id) on delete restrict,
  reading_id uuid references readings(id) on delete restrict,
  triggered_at timestamptz default now(),
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  kind alert_kind not null default 'threshold',
  sensor_id uuid references sensors(id) on delete restrict,
  gateway_id uuid references gateways(id) on delete restrict,
  notify_count integer not null default 0,
  last_notified_at timestamptz,
  notifying_at timestamptz,
  constraint alert_logs_kind_references check (
    (kind = 'threshold'       and alert_config_id is not null and gateway_id is null)
    or (kind = 'sensor_offline'  and sensor_id is not null and alert_config_id is null)
    or (kind = 'gateway_offline' and gateway_id is not null and alert_config_id is null)
  )
);
create unique index alert_logs_one_open_per_config
  on alert_logs (alert_config_id) where is_resolved = false and alert_config_id is not null;
create unique index alert_logs_one_open_per_sensor_offline
  on alert_logs (sensor_id) where is_resolved = false and kind = 'sensor_offline';

-- Phase 1 trigger, as shipped.
create or replace function readings_after_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  update sensors
     set last_reading_at = new.recorded_at, last_reading_id = new.id, last_temperature = new.temperature
   where id = new.sensor_id and (last_reading_at is null or last_reading_at < new.recorded_at);
  return new;
end; $$;
create trigger readings_stamp_sensor after insert on readings for each row execute function readings_after_insert();

-- Phase 2 / 2b tables, as shipped.
create table platform_status (
  id boolean primary key default true check (id),
  vps_last_seen_at timestamptz,
  chirpstack_ok boolean,
  last_uplink_at timestamptz,
  sweep_last_ok_at timestamptz,
  sender_last_ok_at timestamptz,
  last_customer_email_at timestamptz,
  ops_level text not null default 'ok' check (ops_level in ('ok','late','down')),
  ops_level_since timestamptz,
  ops_notified_at timestamptz
);
insert into platform_status (id) values (true);

create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  detail jsonb
);

-- Roles the migration grants to. Supabase has these; a bare cluster does not.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
