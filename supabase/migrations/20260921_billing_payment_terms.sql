-- Billing: one payment term for every invoice.
--
-- Due date = issue date + payment_terms_days, whatever the invoice type. The
-- admin sets the issue date on the draft and the due date follows; both stay
-- editable. Replaces onboarding_due_days, which only covered one type. That
-- column stays (customer_billing_summary selects the whole settings row, so
-- dropping it would mean rebuilding the view for nothing); it is no longer
-- read anywhere.

-- ── Block 1 ─────────────────────────────────────────────────────────────────
alter table billing_settings add column if not exists payment_terms_days integer not null default 15;

comment on column billing_settings.payment_terms_days is
  'Days from issue date to due date, proposed on every draft. Editable per invoice.';
comment on column billing_settings.onboarding_due_days is
  'Unused since 20260921; payment_terms_days covers every invoice type.';

-- Verify: expect 15.
select payment_terms_days from billing_settings;
