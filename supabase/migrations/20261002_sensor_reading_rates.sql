-- How complete each sensor's record has been lately, for the admin
-- Devices page: readings received live, readings recovered from the
-- sensor's memory, and how many were expected in the window. Admin site
-- only, no alert, no email, by decision on 2026-10-02.
--
-- Expected counts from the later of the window start and the sensor's
-- commissioning, so a sensor installed yesterday is judged on yesterday.
-- Retired and uncommissioned sensors are left out.
--
-- Run in the Supabase SQL editor; ends with a verify.

create or replace function sensor_reading_rates(window_days integer, interval_minutes integer)
returns table (
  sensor_id uuid,
  hardware_id text,
  live_count bigint,
  backfilled_count bigint,
  expected integer
)
language sql
stable
security definer
set search_path = public
as $$
  with w as (
    select now() - make_interval(days => window_days) as since
  )
  select
    s.id,
    s.hardware_id,
    count(r.id) filter (where not r.backfilled),
    count(r.id) filter (where r.backfilled),
    greatest(0, floor(extract(epoch from (now() - greatest(w.since, s.commissioned_at))) / (interval_minutes * 60)))::integer
  from sensors s
  cross join w
  left join readings r
    on r.sensor_id = s.id
   and r.recorded_at >= greatest(w.since, s.commissioned_at)
  where s.decommissioned_at is null
    and s.commissioned_at is not null
  group by s.id, s.hardware_id, w.since, s.commissioned_at;
$$;

comment on function sensor_reading_rates(integer, integer) is
  'Per live, commissioned sensor: readings received live and recovered in the '
  'last window_days, and how many were expected at one every interval_minutes. '
  'Service role only.';

revoke all on function sensor_reading_rates(integer, integer) from public, anon, authenticated;
grant execute on function sensor_reading_rates(integer, integer) to service_role;

-- Verify: one row per live sensor; expected near 672 for a week at 15 min.
select * from sensor_reading_rates(7, 15);
