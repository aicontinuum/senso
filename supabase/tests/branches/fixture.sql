-- On top of the alerting fixture: the columns and the auth stub the branches
-- migration touches. Supabase provides auth.uid(); here it reads the claim
-- the test sets, so RLS can be exercised as a signed-in customer.

alter table customers add column if not exists auth_user_id uuid;
alter table customers add column if not exists timezone text not null default 'Asia/Qatar';
alter table gateways add column if not exists name text not null default 'Gateway';
alter table gateways add column if not exists location text;

create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Live Supabase lets a signed-in customer read their own row; the policy
-- on branches looks it up, so the fixture needs the same grant.
grant select on customers to authenticated;

-- A customer that exists before the migration runs, to prove the backfill.
insert into customers (id, name, email, auth_user_id) values
  ('00000000-0000-0000-0000-00000000c0a1', 'Fresh Foods', 'ops@fresh.example', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000c0a2', 'Quiet Cafe',  'owner@quiet.example', '00000000-0000-0000-0000-0000000000a2');
insert into gateways (id, customer_id, name, mac_address) values
  ('00000000-0000-0000-0000-00000000900a', '00000000-0000-0000-0000-00000000c0a1', 'Fresh GW', 'aa00000000000001'),
  ('00000000-0000-0000-0000-00000000900b', '00000000-0000-0000-0000-00000000c0a2', 'Quiet GW', 'aa00000000000002');
