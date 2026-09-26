-- The locked notice is shown on the login page, after the suspended
-- account has been signed out, so the contact details must be readable
-- without a session. They are Senso's own phone and email, nothing else.

-- ── Block 1 ─────────────────────────────────────────────────────────────────
grant execute on function public.senso_support_contact() to anon;

-- Verify: expect anon among the grantees.
select grantee from information_schema.routine_privileges
 where routine_name = 'senso_support_contact' order by grantee;
