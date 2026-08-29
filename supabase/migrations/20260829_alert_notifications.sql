-- Email alerting: offline detection, a reminder schedule, and the guards that
-- stop two cron runs sending the same alert twice.
--
-- Until now `alert_logs` only ever held threshold breaches, created by
-- /api/ingest when a reading arrived. That misses the case that matters most: a
-- sensor that goes silent. No reading means no ingest, which means no code runs
-- and nobody is told — precisely when a fridge is failing and its sensor has
-- died with it. A scheduled sweep now raises those, and they live in the same
-- table so one query drives both the alerts page and the email sender.

-- ── 1. What kind of alert this is ──────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'alert_kind') then
    create type alert_kind as enum ('threshold', 'sensor_offline', 'gateway_offline');
  end if;
end $$;

alter table alert_logs
  add column if not exists kind alert_kind not null default 'threshold',
  add column if not exists sensor_id uuid references sensors(id) on delete restrict,
  add column if not exists gateway_id uuid references gateways(id) on delete restrict;

-- Offline alerts have no threshold config and no triggering reading, so the
-- columns that were mandatory for a breach become optional.
alter table alert_logs alter column alert_config_id drop not null;
alter table alert_logs alter column reading_id drop not null;

-- Each kind must carry the reference that identifies what it is about, and must
-- not carry ones that make no sense for it.
alter table alert_logs drop constraint if exists alert_logs_kind_references;
alter table alert_logs add constraint alert_logs_kind_references check (
  (kind = 'threshold'       and alert_config_id is not null and gateway_id is null)
  or (kind = 'sensor_offline'  and sensor_id is not null and alert_config_id is null)
  or (kind = 'gateway_offline' and gateway_id is not null and alert_config_id is null)
);


-- ── 2. Notification state ──────────────────────────────────────────────────
--
-- The schedule is: send immediately, remind after 30 minutes, remind again after
-- 2 hours, then stay quiet until the alert resolves. `notify_count` is how far
-- through that an alert has got.
--
-- `notifying_at` is a lease, not a flag. A sender claims a row by stamping it,
-- and only clears it once the send succeeded. A run that crashes mid-send leaves
-- a stale lease, which becomes claimable again after a few minutes, so the alert
-- is retried rather than lost. Incrementing the count up front would have been
-- simpler but would burn a reminder slot on a failed send — for a fridge alert a
-- missed notification is worse than a duplicate.

alter table alert_logs
  add column if not exists notify_count integer not null default 0,
  add column if not exists last_notified_at timestamptz,
  add column if not exists notifying_at timestamptz;


-- ── 3. One open alert per thing ────────────────────────────────────────────
--
-- Enforced here rather than in application code, so two concurrent ingest calls
-- (or the sweep racing ingest) cannot both open one. This is also what makes an
-- incident a single row: previously a persistent breach resolved and re-opened
-- every 30 minutes, so a six-hour problem became twelve rows in the alert
-- history and would have become twelve emails.

create unique index if not exists alert_logs_one_open_per_config
  on alert_logs (alert_config_id)
  where is_resolved = false and alert_config_id is not null;

create unique index if not exists alert_logs_one_open_per_sensor_offline
  on alert_logs (sensor_id)
  where is_resolved = false and kind = 'sensor_offline';

create unique index if not exists alert_logs_one_open_per_gateway_offline
  on alert_logs (gateway_id)
  where is_resolved = false and kind = 'gateway_offline';

-- The sender scans for due alerts constantly; this is the index it uses.
create index if not exists alert_logs_pending_notification
  on alert_logs (is_resolved, notify_count, last_notified_at)
  where is_resolved = false;


-- ── 4. Claiming alerts to send ─────────────────────────────────────────────
--
-- PostgREST cannot express row locking, so claiming is a function. `for update
-- skip locked` is what stops two overlapping cron runs picking the same alert:
-- the second run skips rows the first is holding rather than blocking on them.
--
-- Returns the rows it claimed. The caller sends, then calls
-- mark_alerts_notified() for the ones that actually went out.

create or replace function claim_due_alerts(
  p_limit integer default 100,
  p_lease_seconds integer default 300
)
returns setof alert_logs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update alert_logs
     set notifying_at = clock_timestamp()
   where id in (
     select id
       from alert_logs
      where is_resolved = false
        -- Not already being sent by another run, unless that run's lease expired.
        and (notifying_at is null
             or notifying_at < clock_timestamp() - make_interval(secs => p_lease_seconds))
        and (
          -- Never sent.
          notify_count = 0
          -- First reminder, 30 minutes after the alert opened.
          or (notify_count = 1 and triggered_at < clock_timestamp() - interval '30 minutes')
          -- Second and last reminder, 2 hours after it opened.
          or (notify_count = 2 and triggered_at < clock_timestamp() - interval '2 hours')
        )
      order by triggered_at
      limit p_limit
      for update skip locked
   )
  returning *;
end;
$$;

-- Called after a successful send. Clearing the lease and advancing the count in
-- one statement means a row can never be left claimed but uncounted.
create or replace function mark_alerts_notified(p_ids uuid[])
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update alert_logs
       set notify_count = notify_count + 1,
           last_notified_at = clock_timestamp(),
           notifying_at = null
     where id = any(p_ids)
    returning 1
  )
  select count(*)::integer from updated;
$$;

-- Releases a lease without counting a send, for when delivery failed. The alert
-- is then picked up by the next run instead of silently losing its turn.
create or replace function release_alert_claims(p_ids uuid[])
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update alert_logs set notifying_at = null where id = any(p_ids)
    returning 1
  )
  select count(*)::integer from updated;
$$;


-- ── 5. Privileges ──────────────────────────────────────────────────────────
--
-- Only the service role runs these: they are called from the cron route, which
-- uses the service key. Customers read alert_logs through their existing policy
-- and must not be able to claim or mark anything.

revoke all on function claim_due_alerts(integer, integer) from public;
revoke all on function mark_alerts_notified(uuid[]) from public;
revoke all on function release_alert_claims(uuid[]) from public;

grant execute on function claim_due_alerts(integer, integer) to service_role;
grant execute on function mark_alerts_notified(uuid[]) to service_role;
grant execute on function release_alert_claims(uuid[]) to service_role;
