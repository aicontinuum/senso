# Branches fixture tests

Proves `20260925_branches.sql` against a real PostgreSQL 16 before it touches
the live project. Reuses the alerting fixture for `customers` and `gateways`;
`fixture.sql` adds the columns the migration reads and a stub `auth.uid()` so
the row-level policy can be exercised as a signed-in customer.

What is covered: the backfill (one branch per existing customer, named after
the business, every gateway pointed at it); the default branch for a new
customer; names (unique per customer ignoring case and spacing, blank refused,
the same name allowed across customers); the same-customer guard on insert,
on moving a gateway, and on moving a branch; a branch with a gateway cannot be
deleted while an empty one can; grants and the select policy.

## Run it

```bash
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres
psql -c 'drop database if exists senso_test' -c 'create database senso_test'
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/alerting-v2/fixture.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/branches/fixture.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260925_branches.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/branches/test.sql 2>&1 | grep -E 'PASS|FAIL'
```

Every line should read `PASS`.
