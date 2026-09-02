-- Let a supervisor explain an incident on the record.
--
-- A report showing 18 °C for two hours is a failing fridge. The same report
-- annotated "cleaning the fridge, doors open" is a well-run kitchen. Until now
-- there was nowhere to say which, so every excursion read as the first kind.
--
-- Deliberately the *safe* half of the service-window idea: a comment explains a
-- breach, it does not suppress the alert or remove readings. Nothing here can
-- hide anything — the readings, the breach and the alert all stand exactly as
-- they were.
--
-- ⚠️ RUN THIS IN BLOCKS. Pasting a whole migration into the Supabase SQL editor
-- has repeatedly run only as far as the first `$$`-quoted body and silently
-- skipped the rest. Blocks are marked; verification is at the end.


-- ── Block 1 ── the table ────────────────────────────────────────────────────
--
-- One comment per alert, because one alert is one incident. The unique
-- constraint is what makes "add or edit" a single upsert rather than a race
-- between two supervisors both adding a first comment.
--
-- `author_id` defaults to auth.uid() rather than being supplied by the client:
-- a caller cannot attribute a comment to someone else even if it tries.

create table if not exists alert_comments (
  id uuid primary key default gen_random_uuid(),
  alert_log_id uuid not null unique references alert_logs(id) on delete restrict,
  body text not null,
  author_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Length is capped here as well as in the API. The API is the door people use;
  -- this is the wall.
  constraint alert_comment_body_length check (
    length(btrim(body)) > 0 and length(body) <= 500
  )
);

comment on table alert_comments is
  'Supervisor note explaining one alert. Shown on the alert page and repeated '
  'against every breaching reading in a report. Never suppresses an alert or '
  'excludes a reading.';


-- ── Block 2 ── updated_at is the database''s job ────────────────────────────
--
-- Customers write this table directly through RLS, so `updated_at` cannot be
-- trusted to the client — a comment could otherwise be edited while claiming it
-- never was. The column grants in block 4 stop the client setting it at all;
-- this sets it.

create or replace function set_alert_comment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  -- Neither of these may move on an edit: who wrote a note and when are part of
  -- what the note is worth.
  new.created_at := old.created_at;
  new.author_id  := old.author_id;
  return new;
end;
$$;

drop trigger if exists alert_comments_touch_updated_at on alert_comments;
create trigger alert_comments_touch_updated_at
  before update on alert_comments
  for each row
  execute function set_alert_comment_updated_at();


-- ── Block 3 ── row-level security ───────────────────────────────────────────
--
-- Ownership resolves through the existing customer_owns_sensor() helper, the
-- same one readings, alert_configs and threshold history use. One definition of
-- "this customer owns this sensor" means a future change to that rule cannot
-- leave this table behind.

alter table alert_comments enable row level security;

drop policy if exists customers_select_own_alert_comments on alert_comments;
create policy customers_select_own_alert_comments
  on alert_comments for select to authenticated
  using (
    exists (
      select 1 from alert_logs al
      join alert_configs ac on ac.id = al.alert_config_id
      where al.id = alert_comments.alert_log_id
        and customer_owns_sensor(ac.sensor_id)
    )
  );

drop policy if exists customers_insert_own_alert_comments on alert_comments;
create policy customers_insert_own_alert_comments
  on alert_comments for insert to authenticated
  with check (
    exists (
      select 1 from alert_logs al
      join alert_configs ac on ac.id = al.alert_config_id
      where al.id = alert_comments.alert_log_id
        and customer_owns_sensor(ac.sensor_id)
    )
  );

drop policy if exists customers_update_own_alert_comments on alert_comments;
create policy customers_update_own_alert_comments
  on alert_comments for update to authenticated
  using (
    exists (
      select 1 from alert_logs al
      join alert_configs ac on ac.id = al.alert_config_id
      where al.id = alert_comments.alert_log_id
        and customer_owns_sensor(ac.sensor_id)
    )
  );

-- No delete policy. A note explaining an incident is part of that incident's
-- record; removing it would leave the breach standing with its explanation gone.
-- Editing to correct a mistake is enough.


-- ── Block 4 ── column-scoped grants ─────────────────────────────────────────
--
-- The same lesson as sensors: a row-scoped policy without column scope lets a
-- client write every column of a row it owns. Here that would mean back-dating
-- created_at, or reassigning author_id to another user.
--
-- Insert supplies only the alert and the text; everything else is defaulted.
-- Update touches only the text; the trigger moves updated_at.

revoke all on table alert_comments from anon, authenticated;
grant select on table alert_comments to authenticated;
grant insert (alert_log_id, body) on table alert_comments to authenticated;
grant update (body) on table alert_comments to authenticated;
grant select, insert, update on table alert_comments to service_role;


-- ── Verification — run these, do not assume ─────────────────────────────────
--
-- 1. Table and trigger exist.
--    Expect: alert_comments, then one row with tgenabled = O
--
--    select to_regclass('public.alert_comments');
--    select tgname, tgenabled from pg_trigger
--     where tgname = 'alert_comments_touch_updated_at';
--
-- 2. Three policies — select, insert, update. No delete.
--    Expect: 3 rows
--
--    select policyname, cmd from pg_policies where tablename = 'alert_comments';
--
-- 3. Customers can write only the two columns they should.
--    Expect: INSERT on alert_log_id and body; UPDATE on body. Nothing else.
--
--    select privilege_type, column_name
--      from information_schema.column_privileges
--     where table_name = 'alert_comments' and grantee = 'authenticated'
--       and privilege_type in ('INSERT','UPDATE')
--     order by privilege_type, column_name;
