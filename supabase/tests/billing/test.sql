-- Fixture cases for the billing migration. Every case asserts; any failure
-- raises and aborts the script with the case name. Runs in one transaction
-- and rolls back, so it can be re-run at will.

\set ON_ERROR_STOP on

create or replace function assert(cond boolean, name text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', name; end if;
  raise notice 'PASS: %', name;
end $$;

-- Runs a statement expected to fail; passes when it raises.
create or replace function assert_raises(stmt text, name text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'PASS: % (%)', name, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % (did not raise)', name;
end $$;

begin;

insert into customers (id, name, email) values
  ('00000000-0000-0000-0000-00000000c001', 'Fresh Foods', 'billing@fresh.example'),
  ('00000000-0000-0000-0000-00000000c002', 'Quiet Cafe',  'owner@quiet.example'),
  ('00000000-0000-0000-0000-00000000c003', 'New Shop',    'new@shop.example');

-- ── Settings ────────────────────────────────────────────────────────────────
select assert((select count(*) = 1 from billing_settings), 'settings has one row');
select assert((select tax_rate = 0 and starter_monthly = 450 and months_charged_12 = 11 from billing_settings), 'settings defaults');
select assert_raises($q$insert into billing_settings (id, company_name) values (false, 'x')$q$, 'settings cannot get a second row');

-- ── Subscriptions ───────────────────────────────────────────────────────────
insert into subscriptions (id, customer_id, tier, sensor_count, addon_count, addon_monthly_rate, term_months, monthly_rate, term_total, term_start, renewal_date)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 'standard', 5, 1, 120, 12, 820, 10340, current_date - 345, current_date + 20);
-- Second branch, ends in a month and is not in the notice window.
insert into subscriptions (id, customer_id, label, tier, sensor_count, term_months, monthly_rate, term_total, term_start, renewal_date)
values ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000c001', 'Al Sadd', 'starter', 2, 6, 450, 2700, current_date - 120, current_date + 60);
-- Quiet Cafe: starter, renewal far away.
insert into subscriptions (id, customer_id, tier, sensor_count, term_months, monthly_rate, term_total, term_start, renewal_date)
values ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000c002', 'starter', 3, 12, 450, 4950, current_date - 30, current_date + 335);

select assert_raises($q$insert into subscriptions (customer_id, tier, term_months, monthly_rate, term_total) values ('00000000-0000-0000-0000-00000000c001', 'starter', 9, 450, 0)$q$, 'term must be 6 or 12');

-- ── Draft invoice: lines and totals ─────────────────────────────────────────
insert into invoices (id, customer_id, subscription_id, type, due_on)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a001', 'renewal', current_date + 20);
insert into invoice_lines (invoice_id, position, description, quantity, unit_amount, amount) values
  ('00000000-0000-0000-0000-00000000e001', 1, 'Standard plan, 12 months', 11, 820, 9020),
  ('00000000-0000-0000-0000-00000000e001', 2, 'Add-on sensor, 12 months', 11, 120, 1320);

select assert((select subtotal = 10340 and discount_amount = 0 and total = 10340 from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'lines sum into subtotal and total');

-- Percent discount.
update invoices set discount_label = 'Loyalty', discount_type = 'percent', discount_value = 10 where id = '00000000-0000-0000-0000-00000000e001';
select assert((select discount_amount = 1034 and total = 9306 from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'percent discount recomputes totals');

-- Amount discount, capped at the subtotal.
update invoices set discount_type = 'amount', discount_value = 500 where id = '00000000-0000-0000-0000-00000000e001';
select assert((select discount_amount = 500 and total = 9840 from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'amount discount recomputes totals');
update invoices set discount_value = 99999 where id = '00000000-0000-0000-0000-00000000e001';
select assert((select discount_amount = 10340 and total = 0 from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'amount discount is capped at the subtotal');
update invoices set discount_value = 500 where id = '00000000-0000-0000-0000-00000000e001';

-- Tax rate on the invoice.
update invoices set tax_rate = 0.05 where id = '00000000-0000-0000-0000-00000000e001';
select assert((select tax_amount = 492 and total = 10332 from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'tax applies after discount');
update invoices set tax_rate = 0 where id = '00000000-0000-0000-0000-00000000e001';

-- Discount shape: type without value is rejected.
select assert_raises($q$update invoices set discount_type = 'percent', discount_value = null where id = '00000000-0000-0000-0000-00000000e001'$q$, 'discount needs both type and value');

-- Editing and deleting a line while draft.
update invoice_lines set amount = 9000 where invoice_id = '00000000-0000-0000-0000-00000000e001' and position = 1;
select assert((select subtotal = 10320 from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'line override recomputes subtotal');
delete from invoice_lines where invoice_id = '00000000-0000-0000-0000-00000000e001' and position = 2;
select assert((select subtotal = 9000 and total = 8500 from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'line delete recomputes totals');
insert into invoice_lines (invoice_id, position, description, quantity, unit_amount, amount)
  values ('00000000-0000-0000-0000-00000000e001', 2, 'Add-on sensor, 12 months', 11, 120, 1320);

-- A draft cannot be paid or sent by hand.
select assert_raises($q$update invoices set state = 'sent' where id = '00000000-0000-0000-0000-00000000e001'$q$, 'draft cannot be marked sent without a number');
select assert_raises($q$insert into payments (invoice_id, customer_id, amount, method) values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 100, 'cash')$q$, 'no payment against a draft');
select assert_raises($q$select void_invoice('00000000-0000-0000-0000-00000000e001', 'x')$q$, 'draft cannot be voided');

-- A draft can be deleted, and its lines go with it.
insert into invoices (id, customer_id, type) values ('00000000-0000-0000-0000-00000000e0dd', '00000000-0000-0000-0000-00000000c001', 'adjustment');
insert into invoice_lines (invoice_id, description, amount) values ('00000000-0000-0000-0000-00000000e0dd', 'scrap', 1);
delete from invoices where id = '00000000-0000-0000-0000-00000000e0dd';
select assert((select count(*) = 0 from invoice_lines where invoice_id = '00000000-0000-0000-0000-00000000e0dd'), 'draft delete cascades to lines');

-- ── Issue: numbering ────────────────────────────────────────────────────────
select assert((select issue_invoice('00000000-0000-0000-0000-00000000e001', date '2026-09-19') = 'BT-2026-0001'), 'first number of the year');
select assert((select state = 'sent' and issued_on = date '2026-09-19' and total = 10320 - 500 from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'issue sets sent, date and frozen total');
select assert_raises($q$select issue_invoice('00000000-0000-0000-0000-00000000e001')$q$, 'cannot issue twice');

insert into invoices (id, customer_id, type) values ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000c002', 'onboarding');
insert into invoice_lines (invoice_id, description, amount) values ('00000000-0000-0000-0000-00000000e002', 'Starter plan, 12 months', 4950);
select assert((select issue_invoice('00000000-0000-0000-0000-00000000e002', date '2026-09-20') = 'BT-2026-0002'), 'second number increments');
select assert((select due_on = date '2026-09-20' from invoices where id = '00000000-0000-0000-0000-00000000e002'), 'due defaults to issue date (on receipt)');

insert into invoices (id, customer_id, type) values ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000c002', 'adjustment');
insert into invoice_lines (invoice_id, description, amount) values ('00000000-0000-0000-0000-00000000e003', 'x', 10);
select assert((select issue_invoice('00000000-0000-0000-0000-00000000e003', date '2027-01-02') = 'BT-2027-0001'), 'numbering resets per year');
select assert((select last = 2 from invoice_sequences where year = 2026), 'counter for 2026 untouched by 2027');

-- Custom prefix is honoured.
update billing_settings set invoice_prefix = 'ZZ';
insert into invoices (id, customer_id, type) values ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-00000000c002', 'adjustment');
select assert((select issue_invoice('00000000-0000-0000-0000-00000000e004', date '2027-01-03') = 'ZZ-2027-0002'), 'prefix comes from settings');
update billing_settings set invoice_prefix = 'BT';

-- ── Issued: frozen ──────────────────────────────────────────────────────────
select assert_raises($q$insert into invoice_lines (invoice_id, description, amount) values ('00000000-0000-0000-0000-00000000e001', 'late', 1)$q$, 'issued invoice refuses new lines');
select assert_raises($q$update invoice_lines set amount = 1 where invoice_id = '00000000-0000-0000-0000-00000000e001'$q$, 'issued invoice refuses line edits');
select assert_raises($q$delete from invoice_lines where invoice_id = '00000000-0000-0000-0000-00000000e001'$q$, 'issued invoice refuses line deletes');
select assert_raises($q$update invoices set discount_value = 1 where id = '00000000-0000-0000-0000-00000000e001'$q$, 'issued invoice refuses discount change');
select assert_raises($q$update invoices set total = 1 where id = '00000000-0000-0000-0000-00000000e001'$q$, 'issued invoice refuses total change');
select assert_raises($q$update invoices set number = 'BT-2026-9999' where id = '00000000-0000-0000-0000-00000000e001'$q$, 'issued invoice refuses number change');
-- The words are not frozen: descriptions, due date and discount label may be corrected.
update invoice_lines set description = 'Standard plan, Annual (5 sensors), corrected' where invoice_id = '00000000-0000-0000-0000-00000000e001' and position = 1;
select assert((select description like '%corrected' and amount = 9000 from invoice_lines where invoice_id = '00000000-0000-0000-0000-00000000e001' and position = 1), 'issued invoice takes a reworded line');
select assert((select total = 9820 from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'rewording a line leaves the total alone');
update invoices set due_on = current_date + 90, discount_label = 'Loyalty (agreed)' where id = '00000000-0000-0000-0000-00000000e001';
select assert((select due_on = current_date + 90 and discount_label = 'Loyalty (agreed)' from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'issued invoice takes a due date and label change');
select assert_raises($q$update invoice_lines set description = 'x', amount = 1 where invoice_id = '00000000-0000-0000-0000-00000000e001' and position = 1$q$, 'rewording plus an amount change is still refused');
select assert_raises($q$delete from invoices where id = '00000000-0000-0000-0000-00000000e001'$q$, 'issued invoice cannot be deleted');
update invoices set internal_notes = 'called them', sent_at = now(), sent_to = array['billing@fresh.example'] where id = '00000000-0000-0000-0000-00000000e001';
select assert((select internal_notes = 'called them' from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'issued invoice still takes notes and delivery');

-- ── Void ────────────────────────────────────────────────────────────────────
select void_invoice('00000000-0000-0000-0000-00000000e004', null);
select assert((select state = 'void' and void_reason is null from invoices where id = '00000000-0000-0000-0000-00000000e004'), 'void without a reason');
select void_invoice('00000000-0000-0000-0000-00000000e003', 'wrong amount');
select assert((select state = 'void' and number = 'BT-2027-0001' and void_reason = 'wrong amount' and voided_at is not null from invoices where id = '00000000-0000-0000-0000-00000000e003'), 'void keeps its number');
select void_invoice('00000000-0000-0000-0000-00000000e003', 'again');
select assert((select void_reason = 'wrong amount' from invoices where id = '00000000-0000-0000-0000-00000000e003'), 'voiding twice is a no-op');
select assert_raises($q$update invoices set state = 'sent' where id = '00000000-0000-0000-0000-00000000e003'$q$, 'void cannot be revived');
select assert_raises($q$insert into payments (invoice_id, customer_id, amount, method) values ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000c002', 10, 'cash')$q$, 'no payment against a void');
insert into invoices (id, customer_id, type) values ('00000000-0000-0000-0000-00000000e005', '00000000-0000-0000-0000-00000000c002', 'adjustment');
select assert((select issue_invoice('00000000-0000-0000-0000-00000000e005', date '2027-01-04') = 'BT-2027-0003'), 'a voided number is never reused');

-- ── Payments ────────────────────────────────────────────────────────────────
insert into payments (invoice_id, customer_id, amount, method, reference) values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 5000, 'bank_transfer', 'TRX1');
select assert((select state = 'sent' from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'partial payment leaves invoice sent');
insert into payments (invoice_id, customer_id, amount, method) values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 4820, 'cash');
select assert((select state = 'paid' from invoices where id = '00000000-0000-0000-0000-00000000e001'), 'payments covering the total settle the invoice');
select assert_raises($q$select void_invoice('00000000-0000-0000-0000-00000000e001', 'x')$q$, 'paid cannot be voided');
select assert_raises($q$update invoices set state = 'void' where id = '00000000-0000-0000-0000-00000000e001'$q$, 'paid cannot be voided by hand either');
select assert_raises($q$insert into payments (invoice_id, customer_id, amount, method) values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 0, 'cash')$q$, 'payment must be positive');

-- ── Customer status ─────────────────────────────────────────────────────────
select assert_raises($q$update customers set status = 'overdue' where id = '00000000-0000-0000-0000-00000000c001'$q$, 'customer status vocabulary is pinned');

-- ── Summary view ────────────────────────────────────────────────────────────
-- Fresh Foods: two subscriptions, 8 sensors, renewal in 20 days, renewal
-- invoice already issued, nothing outstanding.
select assert((select billing_status = 'active' and subscription_count = 2 and sensor_count = 8 and next_renewal = current_date + 20 and days_to_renewal = 20 and outstanding = 0 and last_payment_on = current_date
               from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c001'), 'summary: fresh foods row');
select assert((select annualised = 10340 + 5400 from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c001'), 'summary: annualised across subscriptions');
select assert((select renewal_needs_invoice = false from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c001'), 'summary: issued renewal clears the renewal item');

-- Quiet Cafe: onboarding invoice sent, unpaid, due yesterday → overdue 1 day,
-- awaiting first payment, not yet a suspension candidate.
insert into invoices (id, customer_id, subscription_id, type, due_on) values ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000a003', 'onboarding', current_date - 1);
insert into invoice_lines (invoice_id, description, amount) values ('00000000-0000-0000-0000-00000000e006', 'Starter plan, 12 months', 4950);
select issue_invoice('00000000-0000-0000-0000-00000000e006', current_date - 1);
select assert((select billing_status = 'overdue' and overdue_amount = 4950 and days_overdue = 1 and awaiting_first_payment and not suspension_candidate
               from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c002'), 'summary: overdue is derived from a sent invoice past due');
-- outstanding = the two sent invoices (e002 4950 due on receipt + e004 0 + e005 0 + e006 4950)
select assert((select outstanding = 9900 from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c002'), 'summary: outstanding sums sent invoices');

-- 14 days overdue → suspension candidate.
insert into invoices (id, customer_id, type, due_on) values ('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-00000000c002', 'adjustment', current_date - 14);
insert into invoice_lines (invoice_id, description, amount) values ('00000000-0000-0000-0000-00000000e007', 'Extra visit', 200);
select issue_invoice('00000000-0000-0000-0000-00000000e007', current_date - 14);
select assert((select days_overdue = 14 and suspension_candidate from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c002'), 'summary: suspension candidate at the threshold');

-- Suspended by hand beats overdue; suspended customers are not candidates.
update customers set status = 'suspended', suspended_at = now() where id = '00000000-0000-0000-0000-00000000c002';
select assert((select billing_status = 'suspended' and not suspension_candidate from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c002'), 'summary: manual suspension wins');
update customers set status = 'active', suspended_at = null where id = '00000000-0000-0000-0000-00000000c002';

-- Paying the overdue invoices clears overdue without any flag to reset.
insert into payments (invoice_id, customer_id, amount, method) values
  ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000c002', 4950, 'bank_transfer'),
  ('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-00000000c002', 200, 'cash');
select assert((select billing_status = 'active' and overdue_amount = 0 and days_overdue = 0 and not suspension_candidate from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c002'), 'summary: paying clears overdue');

-- Renewal window: move Quiet Cafe's renewal to 10 days out with no renewal
-- invoice → needs one; a draft renewal clears it.
update subscriptions set renewal_date = current_date + 10 where id = '00000000-0000-0000-0000-00000000a003';
select assert((select renewal_needs_invoice from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c002'), 'summary: renewal inside the window needs an invoice');
insert into invoices (id, customer_id, subscription_id, type) values ('00000000-0000-0000-0000-00000000e008', '00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000a003', 'renewal');
select assert((select not renewal_needs_invoice from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c002'), 'summary: a draft renewal clears the item');
-- Past renewal date: no longer flagged as "needs invoice" (it is overdue territory).
update subscriptions set renewal_date = current_date - 1 where id = '00000000-0000-0000-0000-00000000a003';
delete from invoices where id = '00000000-0000-0000-0000-00000000e008';
select assert((select not renewal_needs_invoice and days_to_renewal = -1 from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c002'), 'summary: a passed renewal is not a notice item');

-- New Shop: no subscription, no invoices → present with zeros.
select assert((select billing_status = 'active' and sensor_count = 0 and outstanding = 0 and annualised = 0 and next_renewal is null and not renewal_needs_invoice and not awaiting_first_payment
               from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c003'), 'summary: customer without billing is a zero row');

-- Ended subscriptions drop out.
update subscriptions set ended_at = current_date where id = '00000000-0000-0000-0000-00000000a002';
select assert((select subscription_count = 1 and sensor_count = 6 from customer_billing_summary where customer_id = '00000000-0000-0000-0000-00000000c001'), 'summary: ended subscription is excluded');

-- ── Notes and events ────────────────────────────────────────────────────────
insert into billing_notes (customer_id, body) values ('00000000-0000-0000-0000-00000000c001', 'Prefers bank transfer.');
insert into billing_events (customer_id, subscription_id, kind, field, old_value, new_value, reason)
  values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a001', 'override', 'monthly_rate', '820', '800', 'long-term customer');
select assert((select count(*) = 1 from billing_notes) and (select count(*) = 1 from billing_events), 'notes and events accept rows');

-- ── Grants ──────────────────────────────────────────────────────────────────
select assert((select bool_and(relrowsecurity) from pg_class where relname in ('billing_settings','subscriptions','invoices','invoice_lines','invoice_sequences','payments','billing_notes','billing_events')), 'RLS on every billing table');
select assert(not has_table_privilege('anon', 'invoices', 'select') and not has_table_privilege('authenticated', 'invoices', 'select'), 'anon and authenticated cannot read invoices');
select assert(has_table_privilege('service_role', 'invoices', 'select'), 'service_role can read invoices');

rollback;
