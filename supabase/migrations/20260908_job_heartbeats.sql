-- Somewhere for a scheduled job to say "I ran".
--
-- The alert sender runs every five minutes from a crontab on the ChirpStack VPS.
-- Nothing watches it. If the VPS reboots badly, the crontab is wiped, or
-- CRON_SECRET drifts out of sync, breaches are still recorded but **no email
-- goes out and nothing anywhere says so** — the quietest failure this product
-- has. You would find out by opening a fridge.
--
-- A watchdog cannot live on the machine it is watching, so the checker runs on
-- Vercel instead: the sender stamps a row here on every successful run, and a
-- daily job reads it and emails us if the stamp has gone stale.
--
-- Deliberately generic. Anything scheduled can claim a key here rather than
-- growing a column per job.
--
-- Single statement plus grants — safe to paste whole.

create table if not exists job_heartbeats (
  job text primary key,
  last_run_at timestamptz not null,
  -- Free-form, for whatever the job wants to leave behind: counts, a version,
  -- the reason it did nothing. Read by people, not by code.
  detail jsonb
);

comment on table job_heartbeats is
  'Liveness stamps from scheduled jobs. A stale row means the job stopped, '
  'which for the alert sender means alerts are silently not being delivered.';

-- Service role only: written by the cron routes, read by the watchdog. No
-- customer has any business seeing it, so RLS is on with no policy at all —
-- which denies every authenticated request by default.
alter table job_heartbeats enable row level security;

revoke all on table job_heartbeats from anon, authenticated;
grant select, insert, update on table job_heartbeats to service_role;

-- Verification — expect one row named 'alerts' within five minutes of deploying,
-- and `age` to stay under a minute or two whenever you look.
--
--   select job, last_run_at, now() - last_run_at as age, detail
--     from job_heartbeats;
