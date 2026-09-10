-- Phase 2b of Alerting v2: tell Senso, and only Senso, when the platform is down.
--
-- The admin dashboard card already shows whether our own infrastructure is
-- alive. This makes the database *say so* without anyone looking: every five
-- minutes pg_cron calls the admin app's watchdog endpoint, which compares the
-- platform's current level with the last one it recorded and, when that has
-- changed, sends one email to OPS_ALERT_EMAIL. One on the way down, one on
-- recovery, never a repeat while a state holds, and never to a customer.
--
-- The schedule runs inside Supabase rather than on the VPS for the obvious
-- reason: the VPS dying is the first thing it exists to report.
--
-- Run block by block. Block 2 needs a value pasted in before running.


-- ── Block 1: remember the last level reported ───────────────────────────────
--
-- The watchdog only emails on a transition, so it needs to know what it said
-- last time. Three columns on the existing status row.

alter table platform_status
  add column if not exists ops_level        text not null default 'ok'
    check (ops_level in ('ok', 'late', 'down')),
  add column if not exists ops_level_since  timestamptz,
  add column if not exists ops_notified_at  timestamptz;

comment on column platform_status.ops_level is
  'The platform level the watchdog last reported to OPS_ALERT_EMAIL. Emails go '
  'out only when the assessed level differs from this.';

-- Verify: expect three rows.
select column_name
  from information_schema.columns
 where table_name = 'platform_status'
   and column_name in ('ops_level', 'ops_level_since', 'ops_notified_at');


-- ── Block 2: the secret the database uses to call the admin app ─────────────
--
-- pg_net has to authenticate to /api/platform/watchdog the same way the VPS
-- crontab authenticates to the alert route: the CRON_SECRET bearer token. It is
-- stored in Supabase Vault, encrypted at rest, and read back only inside the
-- scheduled statement. It never appears in cron.job or in any log.
--
-- Replace the placeholder with the CRON_SECRET value set in Vercel, run once,
-- then clear this block from the editor. Re-running with the same name fails
-- harmlessly; to rotate, delete the row in vault.secrets and run again.

select vault.create_secret('PASTE-THE-CRON_SECRET-VALUE-HERE', 'cron_secret');

-- Verify: expect one row named cron_secret. The value itself is not shown.
select name, created_at from vault.secrets where name = 'cron_secret';


-- ── Block 3: the schedule ───────────────────────────────────────────────────
--
-- pg_net makes the HTTP call asynchronously; the statement returns at once and
-- the request is delivered by a background worker. The endpoint does the
-- thinking. If pg_net is not yet enabled on this project, enable it under
-- Database → Extensions first.

create extension if not exists pg_net;

select cron.schedule(
  'platform-watchdog',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://admin.sensoqa.com/api/platform/watchdog',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Verify: expect one row named platform-watchdog, active.
select jobname, schedule, active from cron.job where jobname = 'platform-watchdog';

-- After five minutes, this should show a run with status succeeded. The HTTP
-- response itself is in net._http_response; a 401 there means the Vault value
-- does not match Vercel's CRON_SECRET.
--
--   select start_time, status, return_message
--     from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'platform-watchdog')
--    order by start_time desc limit 3;
