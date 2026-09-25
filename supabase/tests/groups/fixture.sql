-- On top of the alerting and branches fixtures: the two tables the groups
-- migration rewrites policies on, row-level security switched on for the
-- tables the tests read as a signed-in customer (the live project has it
-- on; the fixtures do not), and the live ownership function as recorded in
-- supabase/baseline. The group itself is seeded by test.sql, after the migration has added the column.

create table if not exists alert_threshold_history (
  id uuid primary key default gen_random_uuid(),
  alert_config_id uuid not null references alert_configs(id) on delete restrict,
  threshold numeric not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz
);

create table if not exists alert_comments (
  id uuid primary key default gen_random_uuid(),
  alert_log_id uuid not null unique references alert_logs(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.customer_owns_sensor(sensor_uuid uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from sensors s
    join gateways g on s.gateway_id = g.id
    join customers c on g.customer_id = c.id
    where s.id = sensor_uuid and c.auth_user_id = auth.uid()
  );
$$;
grant execute on function customer_owns_sensor(uuid) to authenticated;

alter table customers enable row level security;
alter table gateways enable row level security;
alter table sensors enable row level security;
alter table alert_threshold_history enable row level security;
alter table alert_comments enable row level security;
alter table readings enable row level security;
alter table alert_configs enable row level security;
alter table alert_logs enable row level security;
grant insert on alert_configs to authenticated;
grant select on gateways, sensors, readings, alert_configs, alert_logs, alert_threshold_history, alert_comments to authenticated;
-- The write rule the owner login must not pass: renaming a sensor.
grant update (name) on sensors to authenticated;
create policy customers_update_own_sensor_name on sensors
  for update to authenticated using (customer_owns_sensor(id)) with check (customer_owns_sensor(id));
-- The pre-groups read rules, as the live project has them, so the migration
-- has something to replace.
create policy customers_select_own on customers for select to authenticated using (auth.uid() = auth_user_id);
create policy gateways_select_own on gateways for select to authenticated
  using (customer_id = (select id from customers where auth_user_id = auth.uid()));
create policy sensors_select_own on sensors for select to authenticated
  using (gateway_id in (select id from gateways where customer_id = (select id from customers where auth_user_id = auth.uid())));
create policy alert_configs_select_own on alert_configs for select to authenticated using (customer_owns_sensor(sensor_id));
create policy customers_read_own_alert_configs on alert_configs for select to public using (customer_owns_sensor(sensor_id));
create policy customers_select_own_alert_configs on alert_configs for select to authenticated using (customer_owns_sensor(sensor_id));
create policy customers_insert_own_alert_configs on alert_configs for insert to authenticated with check (customer_owns_sensor(sensor_id));
create policy customers_select_own_readings on readings for select to authenticated using (customer_owns_sensor(sensor_id));
create policy readings_select_own on readings for select to authenticated using (customer_owns_sensor(sensor_id));
-- The live rule, threshold alerts only: the gap the migration closes.
create policy alert_logs_select_own on alert_logs for select to authenticated
  using (alert_config_id in (select id from alert_configs where customer_owns_sensor(sensor_id)));
