-- Phase 2 of Alerting v2: know whether the platform is alive, and keep records.
--
-- Three tables. None changes how alerts are raised yet; together they give the
-- admin dashboard a "VPS watchdog" card and give the morning after a strange
-- night something to read.
--
--   platform_status      one row: when each piece of our own infrastructure was
--                        last heard from. Read by the admin card now, and by the
--                        offline sweep from phase 4 so that an outage on our side
--                        can never be reported to a customer as their fridge.
--   job_runs             one row per run of a scheduled job, appended, never
--                        overwritten. Replaces the single job_heartbeats row that
--                        the next run wiped five minutes later.
--   alert_notifications  one row per email attempt to a customer. The compliance
--                        answer to "when were you told", which the product could
--                        not previously give.
--
-- job_heartbeats stays for now: the daily health check still reads it. It is
-- dropped in phase 5 once the health check reads platform_status instead.
--
-- Run block by block. Each ends in a verification query.


-- ── Block 1: platform_status ────────────────────────────────────────────────
--
-- A single row, enforced by a boolean primary key that can only be true. Every
-- column is a timestamp of the last time something was seen working; a null
-- means never. Thresholds live in application code, not here, so they can be
-- tuned without a migration.

create table if not exists platform_status (
  id                     boolean primary key default true check (id),
  -- Stamped by POST /api/platform/pulse, called from a one-line crontab on the
  -- ChirpStack VPS every minute. Stops when the VPS stops.
  vps_last_seen_at       timestamptz,
  -- Reported in the same pulse: whether the ChirpStack container answered a
  -- local health request. Distinguishes "box is up, ChirpStack is not".
  chirpstack_ok          boolean,
  -- Stamped by /api/ingest on every authenticated event ChirpStack sends,
  -- including the join and status events it otherwise drops. Stops when nothing
  -- is reaching ChirpStack from any gateway.
  last_uplink_at         timestamptz,
  -- Stamped by the alert route on a successful offline sweep / send run.
  sweep_last_ok_at       timestamptz,
  sender_last_ok_at      timestamptz,
  -- Stamped when an alert email to a customer was accepted by the provider.
  last_customer_email_at timestamptz
);

comment on table platform_status is
  'Last-seen stamps for Senso''s own infrastructure. One row. Read by the admin '
  'VPS watchdog card, and by the offline sweep so that our outage is never '
  'reported to a customer as their fridge.';

insert into platform_status (id) values (true) on conflict (id) do nothing;

alter table platform_status enable row level security;
revoke all on table platform_status from anon, authenticated;
grant select, update on table platform_status to service_role;

-- Verify: expect exactly one row, all stamps null.
select * from platform_status;


-- ── Block 2: job_runs ───────────────────────────────────────────────────────

create table if not exists job_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  -- Counts, a skip reason, an error message. Read by people, not by code.
  detail      jsonb
);

comment on table job_runs is
  'One row per run of a scheduled job, appended and never overwritten. A run '
  'with ok = false or a detail.skipped reason is the evidence a single '
  'heartbeat row used to erase five minutes later.';

create index if not exists job_runs_job_started_idx on job_runs (job, started_at desc);

alter table job_runs enable row level security;
revoke all on table job_runs from anon, authenticated;
grant select, insert, update, delete on table job_runs to service_role;

-- Verify: expect the index.
select indexname from pg_indexes where tablename = 'job_runs';


-- ── Block 3: alert_notifications ────────────────────────────────────────────
--
-- History, like readings and alert_logs: RESTRICT on the customer so a
-- notification can never be silently orphaned, and no delete grant at all.

create table if not exists alert_notifications (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete restrict,
  -- Every alert the email covered. One email lists everything open for a
  -- customer, so this is an array rather than one row per alert.
  alert_ids     uuid[] not null check (cardinality(alert_ids) > 0),
  recipients    text[] not null,
  attempted_at  timestamptz not null default now(),
  status        text not null check (status in ('sent', 'failed')),
  -- Resend's message id on success; its error code on failure.
  provider_id   text,
  error         text
);

comment on table alert_notifications is
  'One row per alert email attempted to a customer. Append-only compliance '
  'record: when were they told, at which addresses, and did it go.';

create index if not exists alert_notifications_customer_idx
  on alert_notifications (customer_id, attempted_at desc);

alter table alert_notifications enable row level security;
revoke all on table alert_notifications from anon, authenticated;
grant select, insert on table alert_notifications to service_role;

-- Verify: expect three tables with RLS on.
select relname, relrowsecurity
  from pg_class
 where relname in ('platform_status', 'job_runs', 'alert_notifications');


-- ── Block 4: retention for job_runs ─────────────────────────────────────────
--
-- Operational, not compliance: ninety days is plenty to diagnose anything.
-- Scheduled with pg_cron, which Supabase ships on every plan. If the extension
-- is not yet enabled on this project, enable it under Database → Extensions
-- first; the schedule call fails harmlessly otherwise and can be re-run.

create extension if not exists pg_cron;

select cron.schedule(
  'prune-job-runs',
  '17 3 * * *',
  $$ delete from job_runs where started_at < now() - interval '90 days' $$
);

-- Verify: expect one row named prune-job-runs.
select jobname, schedule, active from cron.job where jobname = 'prune-job-runs';
