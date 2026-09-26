-- The Senso contact details a locked-out customer is shown.
--
-- billing_settings is service-role only, rightly: it holds bank details.
-- The lock screen needs two of its columns, phone and billing_email, so
-- a definer function hands those two out and nothing else.

-- ── Block 1 ─────────────────────────────────────────────────────────────────
create or replace function public.senso_support_contact()
returns table (phone text, email text)
language sql stable security definer set search_path = public as $$
  select phone, billing_email from billing_settings where id = true;
$$;

grant execute on function public.senso_support_contact() to authenticated;

-- Verify: expect one row with the phone and email from Settings.
select * from public.senso_support_contact();
