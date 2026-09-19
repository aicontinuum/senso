# Billing fixture tests

Proves `20260919_billing.sql` against a real PostgreSQL 16 before it touches the
live project. Reuses the alerting fixture (`../alerting-v2/fixture.sql`) for the
`customers` table; `test.sql` runs 61 cases and aborts on the first failure.

What is covered: the single settings row and its defaults; term length rule;
draft totals (line sum, percent and amount discounts, cap at subtotal, tax after
discount, line override and delete); draft-only rules (no manual send, no
payment, no void, delete cascades to lines); issue numbering (`BT-YYYY-NNNN`,
per-year reset, prefix from settings, due-on-receipt default); immutability of
everything numbered (lines, discount, totals, number, due date, delete) while
notes and delivery stay editable; void keeps its number, is idempotent, cannot
be revived, and its number is never reused; partial and settling payments; paid
cannot be voided by function or by hand; customer status vocabulary; and every
column the summary view derives (status precedence, overdue, days overdue,
suspension candidate at the threshold, renewal notice window with issued and
draft renewals, passed renewals, zero rows, ended subscriptions, annualised
across branches); RLS and grants.

## Run it

```bash
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres
psql -c 'drop database if exists senso_test' -c 'create database senso_test'
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/alerting-v2/fixture.sql
sed '/── Block 5/,$d' supabase/migrations/20260910_alerting_v2_cutover.sql | psql -d senso_test -v ON_ERROR_STOP=1
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260919_billing.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260920_billing_fawran.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260921_billing_payment_terms.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/billing/test.sql 2>&1 | grep -E 'PASS|FAIL'
```

Every line should read `PASS`. The script runs inside one transaction and rolls
back, so it can be re-run at will.
