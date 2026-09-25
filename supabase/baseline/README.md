# Base schema record

The six original tables, their policies and `customer_owns_sensor()` were
created by hand in the Supabase dashboard before `supabase/migrations/`
began (2026-08-27). This directory is the record of what is live, captured
from the project's catalog on the date in the filename. It is **reference,
not a migration**: nothing here is meant to be run. When one of these
objects changes, the change goes in a dated migration and this record is
refreshed alongside it.

Captured with, in the SQL editor:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('customers', 'gateways', 'sensors')
order by table_name, ordinal_position;

select pg_get_functiondef('public.customer_owns_sensor(uuid)'::regprocedure);

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('customers', 'gateways', 'sensors');
```

Policies on `readings`, `alert_configs` and `alert_logs` were captured on
2026-09-25 and their SELECT rules replaced by `20260927_groups.sql`. Still
to capture: those three tables' columns, and
`information_schema.role_table_grants` for `public` (TODO.md, "Base schema
and RLS policies are not in the repo").
