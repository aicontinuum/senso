-- customer_owns_sensor(): pin the search path.
--
-- The function every write rule delegates to is SECURITY DEFINER, and it
-- was created without a pinned search_path (supabase/baseline). A definer
-- function that resolves table names through the caller's path can be
-- pointed at a look-alike table; pinning it to public closes that. The
-- body is unchanged, so every rule that calls it behaves exactly as before.

-- ── Block 1 ─────────────────────────────────────────────────────────────────
create or replace function public.customer_owns_sensor(sensor_uuid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from sensors s
    join gateways g on s.gateway_id = g.id
    join customers c on g.customer_id = c.id
    where s.id = sensor_uuid
      and c.auth_user_id = auth.uid()
  );
$$;

-- Verify: expect search_path=public.
select proconfig from pg_proc where proname = 'customer_owns_sensor';
