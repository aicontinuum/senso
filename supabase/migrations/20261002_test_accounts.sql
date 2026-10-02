-- A test account: a customer used for rehearsal (the office's own Home
-- account), whose money must never count. Decided 2026-10-02.
--
-- Everything still works on it: plan, invoices, payments, suspension, the
-- customer login. The flag is read by the admin site's billing totals,
-- which skip test accounts the way they skip group accounts, and shown as
-- a chip wherever the account is listed. Device counts and alerts are not
-- affected: the hardware is real.
--
-- Run in the Supabase SQL editor; ends with a verify.

alter table customers add column if not exists is_test boolean not null default false;

comment on column customers.is_test is
  'A rehearsal account whose invoices and payments are excluded from every '
  'billing total. Set from the admin customer page.';

-- Verify: expect one row, boolean, default false.
select column_name, data_type, column_default
  from information_schema.columns
 where table_name = 'customers' and column_name = 'is_test';
