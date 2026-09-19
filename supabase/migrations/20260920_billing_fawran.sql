-- Billing: Fawran alias on the settings row.
--
-- Customers in Qatar pay by Fawran (instant transfer to a registered alias)
-- as readily as by IBAN. The PDF prints whichever of the two is filled in;
-- both may be, either may be blank.

-- ── Block 1 ─────────────────────────────────────────────────────────────────
alter table billing_settings add column if not exists fawran_alias text;

comment on column billing_settings.fawran_alias is
  'Fawran alias customers transfer to. Printed on the invoice when set.';

-- Verify: expect the column.
select column_name from information_schema.columns
 where table_name = 'billing_settings' and column_name = 'fawran_alias';
