-- A sensor is not part of a customer's compliance record until someone says it
-- is installed.
--
-- The problem this closes: a sensor is registered in the admin app during office
-- prep, then powered on for the bench test — and from that moment its readings
-- are attributed to the customer exactly as if it were in their fridge. It is
-- sitting on a desk in Doha reading 25 °C. Those readings reach their dashboard,
-- fire alerts at them, and land in their compliance report as a documented
-- excursion that never happened. An inspector reading that report sees a
-- two-hour failure; the customer cannot prove otherwise, and it is our fault.
--
-- `ONBOARDING.md` step 7 has always said "mark the sensor active". This is the
-- step that was never built.
--
-- The shape deliberately mirrors `decommissioned_at`, which already solves the
-- other end of the same problem: null means not in service, a timestamp means it
-- is, and history is never destroyed either way.
--
-- ⚠️ RUN THIS IN BLOCKS. Pasting a whole migration into the Supabase SQL editor
-- has twice run only as far as the first `$$`-quoted body and silently skipped
-- the rest. The blocks are marked; the verification queries are at the end.


-- ── Block 1 ── the column ───────────────────────────────────────────────────

alter table sensors add column if not exists commissioned_at timestamptz;

comment on column sensors.commissioned_at is
  'When this sensor was installed at the customer site and entered their '
  'compliance record. Null means not in service: readings are still stored, but '
  'they raise no alerts and never appear in a report.';

-- The in-service lookup becomes the common one on every live view.
create index if not exists sensors_in_service_idx
  on sensors (gateway_id)
  where commissioned_at is not null and decommissioned_at is null;


-- ── Block 2 ── backfill ─────────────────────────────────────────────────────
--
-- Every sensor that exists today is treated as having been in service since it
-- was created, so this migration changes no existing report by a single row.
-- Retiring a sensor does not un-commission it, so retired sensors are backfilled
-- too — their history is exactly what reports still need to produce.
--
-- A migration that retroactively removed readings from a compliance record would
-- be the failure mode this feature exists to prevent.

update sensors
   set commissioned_at = created_at
 where commissioned_at is null;


-- ── Block 3 ── ordering constraint ──────────────────────────────────────────
--
-- Added after the backfill, or it would have to hold for rows that had no value
-- yet. A sensor cannot be retired before it was installed.

alter table sensors drop constraint if exists sensors_commission_order;
alter table sensors add constraint sensors_commission_order check (
  commissioned_at is null
  or decommissioned_at is null
  or commissioned_at <= decommissioned_at
);


-- ── Block 4 ── audit trail ──────────────────────────────────────────────────
--
-- Commissioning is reversible, and the reverse direction removes readings from a
-- customer's report. That must never be a silent clear: every change is stamped
-- with who made it and, when un-commissioning, why.
--
-- This is an internal audit of Senso staff actions, so no customer policy — they
-- see the effect through the exclusion note on their report, not the log.

create table if not exists sensor_commissioning_events (
  id uuid primary key default gen_random_uuid(),
  sensor_id uuid not null references sensors(id) on delete restrict,
  action text not null check (action in ('commissioned', 'uncommissioned')),
  -- The value `sensors.commissioned_at` held after this action, so the log alone
  -- reconstructs the timeline without joining back to a column that has since
  -- moved on.
  commissioned_at timestamptz,
  -- auth.users id of the admin who acted. Nullable because a correction made
  -- directly in SQL has no session, and a log that rejected those would simply
  -- not record them.
  actor_id uuid,
  reason text,
  created_at timestamptz not null default clock_timestamp(),

  constraint commissioning_event_shape check (
    (action = 'commissioned' and commissioned_at is not null)
    or (action = 'uncommissioned' and commissioned_at is null
        and reason is not null and length(btrim(reason)) > 0)
  )
);

create index if not exists sensor_commissioning_events_sensor_idx
  on sensor_commissioning_events (sensor_id, created_at desc);

alter table sensor_commissioning_events enable row level security;

revoke all on table sensor_commissioning_events from anon, authenticated;
grant select, insert on table sensor_commissioning_events to service_role;


-- ── Block 5 ── stop customers writing the column ────────────────────────────
--
-- `customers_update_own_sensors` is row-scoped but not column-scoped, so a
-- customer can write any column of their own sensor straight from devtools.
-- Adding `commissioned_at` to that table without this block would hand every
-- customer a switch that erases readings from their own compliance report — set
-- it forward a month and last month is gone from every report they can produce.
--
-- The rename feature is the only thing a customer is meant to change here, so
-- that is the only column they keep. This is a targeted slice of the wider
-- column-scoping item in TODO.md, not the whole of it.
--
-- Column privileges are checked independently of RLS: the policy still decides
-- which rows, this decides which columns.

revoke update on table sensors from anon, authenticated;
grant update (name) on table sensors to authenticated;


-- ── Verification — run these, do not assume ─────────────────────────────────
--
-- 1. Column exists and every existing sensor is in service.
--    Expect: not_commissioned = 0
--
--    select count(*) filter (where commissioned_at is null) as not_commissioned,
--           count(*) as total
--      from sensors;
--
-- 2. Audit table exists.
--    Expect: one row
--
--    select to_regclass('public.sensor_commissioning_events');
--
-- 3. Customers can update `name` and nothing else.
--    Expect: exactly one row, column_name = 'name'
--
--    select grantee, privilege_type, column_name
--      from information_schema.column_privileges
--     where table_name = 'sensors'
--       and grantee = 'authenticated'
--       and privilege_type = 'UPDATE';
--
-- 4. Nothing broader survives at table level.
--    Expect: no UPDATE row for authenticated or anon
--
--    select grantee, privilege_type
--      from information_schema.role_table_grants
--     where table_name = 'sensors' and privilege_type = 'UPDATE';
