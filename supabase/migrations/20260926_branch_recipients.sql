-- Branches: alert recipients per branch.
--
-- A branch may carry its own list of addresses. When it does, that branch's
-- alerts go there instead of to the account list; when it is empty, the
-- account list is used, exactly as before. Head office stays on the account
-- list and keeps hearing about every site; a branch manager is put on their
-- branch and hears about their fridges only.
--
-- The customer may edit this one column of their own branches, the same way
-- they edit the account list. Nothing else on a branch opens to them.

-- ── Block 1: the column ─────────────────────────────────────────────────────
alter table branches add column if not exists alert_recipients text[] not null default '{}';

comment on column branches.alert_recipients is
  'Addresses for this branch''s alerts. Empty means use customers.alert_recipients.';

-- Verify: expect the column.
select column_name from information_schema.columns
 where table_name = 'branches' and column_name = 'alert_recipients';

-- ── Block 2: the customer may edit it ───────────────────────────────────────
grant update (alert_recipients) on table branches to authenticated;

drop policy if exists branches_update_own_recipients on branches;
create policy branches_update_own_recipients
  on branches
  for update
  to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = branches.customer_id
        and c.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from customers c
      where c.id = branches.customer_id
        and c.auth_user_id = auth.uid()
    )
  );

-- Verify: expect select and update.
select policyname, cmd from pg_policies where tablename = 'branches' order by cmd;
