# Alerting v2 fixture tests

Proves the cutover migration against a real PostgreSQL 16 before it touches the
live project. `fixture.sql` reconstructs the live tables (from the
`information_schema` dump taken 2026-09-10); `test.sql` runs 33 cases and aborts
on the first failure.

What is covered: the snapshot stamp and its never-backwards guard; threshold
breach open, continue, resolve and the backdated-reading guard; inactive limits
ignored; uncommissioned sensors stored but never alerted; ChirpStack dedup; the
platform-down hold; the offline sweep's open/close/strand behaviour, its
`triggered_at`, idempotency and recovery.

## Run it

Any local Postgres 16 will do. With the `postgresql` package installed:

```bash
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres
psql -c 'drop database if exists senso_test' -c 'create database senso_test'
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/alerting-v2/fixture.sql
# Blocks 1–4 of the migration; block 5 needs pg_cron and is applied on Supabase only.
sed '/── Block 5/,$d' supabase/migrations/20260910_alerting_v2_cutover.sql | psql -d senso_test -v ON_ERROR_STOP=1
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/alerting-v2/test.sql 2>&1 | grep -E 'PASS|FAIL'
```

Every line should read `PASS`. The script runs inside one transaction and rolls
back, so it can be re-run at will.

## Keeping it honest

If a migration changes any table the fixture models, update `fixture.sql` from a
fresh `information_schema.columns` dump of the live project before trusting a
green run. The fixture is a copy, not the source.
