# Groups fixture tests

Proves `20260927_groups.sql`, `20260928_pin_owns_sensor_search_path.sql` and `20261001_customer_write_scope.sql` against a real PostgreSQL 16 before it touches
the live project. Builds on the alerting and branches fixtures; `fixture.sql`
adds the two tables whose policies the migration rewrites, switches
row-level security on for the tables read as a signed-in customer, defines
the live `customer_owns_sensor()` from the baseline record, and creates a
group with two members and an outsider.

What is covered: structure (only a group has members, never itself, never
another group, at most one group per account, a group owns no gateway, the
flag cannot flip under a row that depends on it, unlinking leaves the
member alone); the owner login reads its members' accounts, gateways,
sensors, branches, readings, thresholds, alerts of both kinds and
memberships and nothing else, and can neither rename a member's sensor nor
add a threshold to it; a member sees only itself, including its
stopped-reporting alerts (hidden by the live rule until now); an outsider
sees nothing of the group; grants; the view function is definer with its
search path pinned; a customer can change their contact details, add and
change thresholds and rename a sensor, and nothing else (not status, name,
email, a config's recipients or kind, a device id, or another customer's
row); the owner login cannot change a member's details; no write rule is
open to anyone.

## Run it

```bash
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres
psql -c 'drop database if exists senso_test' -c 'create database senso_test'
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/alerting-v2/fixture.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/branches/fixture.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260925_branches.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260926_branch_recipients.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/groups/fixture.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260927_groups.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260928_pin_owns_sensor_search_path.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/migrations/20261001_customer_write_scope.sql
psql -d senso_test -v ON_ERROR_STOP=1 -f supabase/tests/groups/test.sql 2>&1 | grep -E 'PASS|FAIL'
```

Every line should read `PASS`.
