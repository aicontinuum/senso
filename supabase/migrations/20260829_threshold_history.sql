-- Effective-dated alert thresholds.
--
-- The problem this fixes: `alert_configs.threshold` was edited in place, so the
-- previous value was destroyed. Two things then read a value that never applied
-- at the time they were describing:
--
--   1. The monitoring report recomputed every historical reading against the
--      *current* threshold. Changing a fridge's minimum from 1 to 1.5 made past
--      readings retroactively "Out of range" even though no alert ever fired and
--      nobody was notified. Worse in the other direction: raising a threshold
--      back up made genuine past violations disappear from every future report,
--      with no trace — a one-click way to erase non-compliance evidence.
--   2. An old alert_log resolved its threshold through alert_config_id, so
--      opening a past alert reported today's number as the one that fired it.
--
-- A report is a compliance record: the same sensor and period must produce the
-- same document every time it is generated. So each reading is judged against
-- the threshold that was in force when it was recorded, and that requires
-- keeping the old values.
--
-- History is maintained by a trigger rather than by application code because
-- thresholds are written from three places — the customer API, the admin API,
-- and by hand in the SQL console. A trigger covers all three and cannot be
-- bypassed; an app-level helper would have to be added twice and still miss the
-- third.

create table if not exists alert_threshold_history (
  id              uuid primary key default gen_random_uuid(),
  alert_config_id uuid not null references alert_configs(id) on delete restrict,
  threshold       numeric not null,
  effective_from  timestamptz not null,
  -- null means "currently in force". Closed versions carry the instant the
  -- replacement took over, so windows are contiguous with no gap.
  effective_to    timestamptz,
  created_at      timestamptz not null default now(),
  constraint effective_window_valid
    check (effective_to is null or effective_to > effective_from)
);

-- Threshold history is evidence, not configuration: it outlives the config row
-- the same way alert_logs does (see 20260827_protect_alert_history.sql).
-- `on delete restrict` above is deliberate and mirrors that decision.

-- Exactly one open version per config. This is what makes "the threshold in
-- force right now" a well-defined question.
create unique index if not exists alert_threshold_history_one_open
  on alert_threshold_history (alert_config_id)
  where effective_to is null;

create index if not exists alert_threshold_history_lookup
  on alert_threshold_history (alert_config_id, effective_from desc);


-- ── History maintenance ────────────────────────────────────────────────────

create or replace function maintain_alert_threshold_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- clock_timestamp(), not now(): now() is fixed for the whole transaction, so
  -- two threshold edits in one transaction would produce a zero-width window and
  -- trip effective_window_valid. Captured once per invocation so the closing
  -- timestamp and the opening one are identical and the windows stay contiguous.
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'INSERT' then
    insert into alert_threshold_history (alert_config_id, threshold, effective_from)
    values (new.id, new.threshold, v_now);
    return new;
  end if;

  -- Only a real change opens a version. The trigger also fires when an UPDATE
  -- merely mentions the column, and editing email recipients must not litter the
  -- history with versions that changed nothing.
  if new.threshold is distinct from old.threshold then
    update alert_threshold_history
       set effective_to = v_now
     where alert_config_id = new.id
       and effective_to is null;

    insert into alert_threshold_history (alert_config_id, threshold, effective_from)
    values (new.id, new.threshold, v_now);
  end if;

  return new;
end;
$$;

drop trigger if exists alert_configs_threshold_history on alert_configs;
create trigger alert_configs_threshold_history
  after insert or update of threshold on alert_configs
  for each row execute function maintain_alert_threshold_history();


-- ── Backfill ───────────────────────────────────────────────────────────────
--
-- No history exists for configs created before this migration, so their current
-- threshold is backdated to -infinity and applies to every reading recorded
-- before now. That is precisely the retroactive behaviour being removed here,
-- accepted once as a one-off: the readings predating this migration are test
-- runs. From this point forward a threshold change can no longer reach
-- backwards.

insert into alert_threshold_history (alert_config_id, threshold, effective_from)
select ac.id, ac.threshold, '-infinity'::timestamptz
from alert_configs ac
where not exists (
  select 1 from alert_threshold_history h where h.alert_config_id = ac.id
);


-- ── Row-level security ─────────────────────────────────────────────────────

alter table alert_threshold_history enable row level security;

-- Read-only for customers. Ownership goes through the existing
-- customer_owns_sensor() security-definer helper — the same one the readings and
-- alert_configs policies use — rather than re-deriving the sensor -> gateway ->
-- customer chain here. One definition of "this customer owns this sensor" means
-- a future change to that rule cannot leave this table behind.
drop policy if exists customers_select_own_threshold_history on alert_threshold_history;
create policy customers_select_own_threshold_history
  on alert_threshold_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from alert_configs ac
      where ac.id = alert_threshold_history.alert_config_id
        and customer_owns_sensor(ac.sensor_id)
    )
  );

-- No insert/update/delete policies, and no write grants: the trigger is
-- security definer, so it is the only thing that can write this table. Nothing
-- reachable from a client session can forge or rewrite a threshold version.
grant select on alert_threshold_history to authenticated, service_role;
