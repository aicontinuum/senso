-- Billing: archive a voided invoice.
--
-- A voided invoice keeps its number and its history forever, but it need
-- not sit in the customer's list forever. Archiving is a marker, nothing
-- more: the row, the lines, the payments and the events all stay, and the
-- list hides it behind a "show archived" link. The issued-invoice guard
-- leaves this column alone because it is not part of the money.

-- ── Block 1 ─────────────────────────────────────────────────────────────────
alter table invoices add column if not exists archived_at timestamptz;

comment on column invoices.archived_at is
  'Set when the admin archives a voided invoice; hides it from lists. The record is untouched.';

-- Verify: expect the column.
select column_name from information_schema.columns
 where table_name = 'invoices' and column_name = 'archived_at';
