-- Billing: plans, terms, invoices, payments, notes, and the change log.
--
-- Manual invoicing, by design (SENSO.md). No gateway, no card, no automatic
-- charge. Admin creates subscriptions, generates invoices, records payments
-- and decides suspensions. Customers never see any of this: every table here
-- is service-role only.
--
-- One principle shapes every column: the system calculates and suggests, it
-- never blocks. Every price, date and count is stored as a value the admin
-- can overwrite per customer; the defaults live in `billing_settings` and the
-- arithmetic lives in the application, not in a CHECK constraint. The only
-- hard rules are the ones that protect the record: an issued invoice is
-- immutable (void and reissue), invoice numbers are sequential per year and
-- never reused, and every override and status change leaves a row.
--
-- Run block by block. Each ends in a verification query.


-- ── Block 1: settings ───────────────────────────────────────────────────────
--
-- One row. Bloctech's own details for the PDF, the bank details, the tax rate
-- (0 until Qatar says otherwise — then this is a settings change, not a
-- rebuild), the payment-term rules, and the pricing defaults the app proposes
-- when a subscription is created. Values to be filled in by the admin.

create table if not exists billing_settings (
  id                      boolean primary key default true check (id),
  -- Who is invoicing.
  company_name            text not null default 'Bloctech',
  cr_number               text,
  address                 text,
  phone                   text,
  billing_email           text,
  logo_url                text,
  -- Where the money goes.
  bank_name               text,
  account_name            text,
  iban                    text,
  tax_registration_number text,
  -- Tax, as a fraction (0.05 = 5 %). No VAT line is printed while this is 0.
  tax_rate                numeric(6,4) not null default 0 check (tax_rate >= 0),
  -- Terms.
  invoice_prefix          text not null default 'BT',
  onboarding_due_days     integer not null default 0,   -- due on receipt
  renewal_notice_days     integer not null default 30,  -- Needs Action window
  suspension_after_days   integer not null default 14,  -- overdue → candidate
  -- Pricing defaults. Proposed, never enforced.
  starter_monthly         numeric(12,2) not null default 450,
  standard_monthly        numeric(12,2) not null default 820,
  addon_monthly           numeric(12,2) not null default 120,  -- Starter/Standard
  addon_monthly_custom    numeric(12,2) not null default 90,   -- Custom tier
  -- Months charged per term: 6 pays 6, 12 pays 11 (one month free).
  months_charged_6        integer not null default 6,
  months_charged_12       integer not null default 11,
  updated_at              timestamptz not null default now()
);

comment on table billing_settings is
  'One row. Bloctech''s invoicing identity, bank details, tax rate, payment '
  'terms and the pricing defaults the app proposes. Everything here is a '
  'default the admin may override per customer or per invoice.';

insert into billing_settings (id) values (true) on conflict (id) do nothing;

alter table billing_settings enable row level security;
revoke all on table billing_settings from anon, authenticated;
grant select, update on table billing_settings to service_role;

-- Verify: expect one row with tax_rate 0 and starter_monthly 450.
select tax_rate, starter_monthly, standard_monthly, months_charged_12 from billing_settings;


-- ── Block 2: subscriptions ──────────────────────────────────────────────────
--
-- A customer may hold several (one per branch). Tier is assigned by hand;
-- the sensor ranges in the brief are guidance for the admin, not a rule here.
-- `term_total` is what gets invoiced and is stored, not derived: the app
-- proposes (monthly + addons) × months charged, the admin may type anything.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'billing_tier') then
    create type billing_tier as enum ('starter', 'standard', 'custom');
  end if;
end $$;

create table if not exists subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references customers(id) on delete restrict,
  -- Optional, for multi-branch customers: "Al Sadd", "Main Branch".
  label              text,
  tier               billing_tier not null,
  sensor_count       integer not null default 0 check (sensor_count >= 0),
  addon_count        integer not null default 0 check (addon_count >= 0),
  addon_monthly_rate numeric(12,2) not null default 0,
  term_months        integer not null check (term_months in (6, 12)),
  -- The tier's monthly figure for this customer (may differ from the default).
  monthly_rate       numeric(12,2) not null,
  -- The amount a term invoice is for. Stored, editable.
  term_total         numeric(12,2) not null,
  -- Anniversary billing: start = installation day, renewal = start + term.
  -- Both editable.
  term_start         date,
  renewal_date       date,
  ended_at           date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx on subscriptions (customer_id);
create index if not exists subscriptions_renewal_idx on subscriptions (renewal_date) where ended_at is null;

alter table subscriptions enable row level security;
revoke all on table subscriptions from anon, authenticated;
grant select, insert, update on table subscriptions to service_role;

-- Verify: expect the enum with three values.
select enum_range(null::billing_tier);


-- ── Block 3: invoices and lines ─────────────────────────────────────────────
--
-- States: draft (editable) → sent (numbered, immutable) → paid; or → void.
-- "Overdue" is not a state: it is a sent invoice past its due date and is
-- computed wherever it is shown, so a paid-late invoice never has to be
-- un-flagged.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'invoice_type') then
    create type invoice_type as enum ('onboarding', 'renewal', 'adjustment');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_state') then
    create type invoice_state as enum ('draft', 'sent', 'paid', 'void');
  end if;
  if not exists (select 1 from pg_type where typname = 'discount_type') then
    create type discount_type as enum ('amount', 'percent');
  end if;
end $$;

create table if not exists invoices (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references customers(id) on delete restrict,
  subscription_id  uuid references subscriptions(id) on delete restrict,
  type             invoice_type not null,
  state            invoice_state not null default 'draft',
  -- Assigned at issue by issue_invoice(); null while draft; kept on void.
  number           text unique,
  issued_on        date,
  due_on           date,
  -- Discount, per invoice, re-entered each time. Its own line on the PDF.
  discount_label   text,
  discount_type    discount_type,
  discount_value   numeric(12,2),
  -- Totals, maintained by refresh_invoice_totals() while draft and frozen at
  -- issue. Stored so the PDF and the ledger show what was actually invoiced.
  subtotal         numeric(12,2) not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  tax_rate         numeric(6,4)  not null default 0,
  tax_amount       numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  -- Never printed.
  internal_notes   text,
  -- Delivery.
  sent_at          timestamptz,
  sent_to          text[],
  pdf_path         text,
  -- Void.
  voided_at        timestamptz,
  void_reason      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint invoices_number_when_issued check (state = 'draft' or number is not null),
  constraint invoices_discount_shape check (
    (discount_type is null and discount_value is null)
    or (discount_type is not null and discount_value is not null and discount_value >= 0)
  )
);

create index if not exists invoices_customer_idx on invoices (customer_id, created_at desc);
create index if not exists invoices_open_idx on invoices (due_on) where state = 'sent';

create table if not exists invoice_lines (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices(id) on delete cascade,
  position     integer not null default 0,
  description  text not null,
  quantity     numeric(12,2) not null default 1,
  unit_amount  numeric(12,2) not null default 0,
  -- Stored, not derived: the admin may override a line total.
  amount       numeric(12,2) not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists invoice_lines_invoice_idx on invoice_lines (invoice_id, position);

alter table invoices enable row level security;
alter table invoice_lines enable row level security;
revoke all on table invoices, invoice_lines from anon, authenticated;
grant select, insert, update, delete on table invoice_lines to service_role;
-- Delete is for drafts only; the guard below refuses anything numbered.
grant select, insert, update, delete on table invoices to service_role;

-- Verify: expect four invoice states.
select enum_range(null::invoice_state);


-- ── Block 4: totals, and the draft-only rule ────────────────────────────────
--
-- Totals are recomputed whenever a draft's lines or discount change:
--   subtotal = Σ line.amount
--   discount = value, or subtotal × value/100, capped at the subtotal
--   tax      = (subtotal − discount) × tax_rate      (rate frozen on the invoice)
--   total    = subtotal − discount + tax
-- Once an invoice is out of draft, its lines cannot change and its money
-- fields cannot change. Void and reissue. This is the one place the database
-- says no, because a printed number must always match what is stored.

create or replace function refresh_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_sub   numeric(12,2);
  v_disc  numeric(12,2);
  v_tax   numeric(12,2);
  v_rate  numeric(6,4);
  v_type  discount_type;
  v_value numeric(12,2);
begin
  select coalesce(sum(amount), 0) into v_sub from invoice_lines where invoice_id = p_invoice_id;
  select tax_rate, discount_type, discount_value into v_rate, v_type, v_value
    from invoices where id = p_invoice_id;

  v_disc := case v_type
    when 'amount'  then least(v_value, v_sub)
    when 'percent' then round(v_sub * v_value / 100, 2)
    else 0 end;
  v_tax := round((v_sub - v_disc) * v_rate, 2);

  update invoices
     set subtotal = v_sub,
         discount_amount = v_disc,
         tax_amount = v_tax,
         total = v_sub - v_disc + v_tax,
         updated_at = now()
   where id = p_invoice_id;
end;
$$;

create or replace function invoice_lines_changed()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_state invoice_state;
  v_id uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  select state into v_state from invoices where id = v_id;
  -- Lines only ever vanish without their invoice when the invoice itself is
  -- being deleted (cascade). The delete guard on invoices has already proven
  -- it was a draft, so there is nothing to recompute.
  if not found and tg_op = 'DELETE' then
    return old;
  end if;
  if v_state is distinct from 'draft' then
    raise exception 'invoice % is %, its lines are frozen — void and reissue', v_id, v_state
      using errcode = 'check_violation';
  end if;
  perform refresh_invoice_totals(v_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists invoice_lines_recalculate on invoice_lines;
create trigger invoice_lines_recalculate
  after insert or update or delete on invoice_lines
  for each row execute function invoice_lines_changed();

create or replace function invoices_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- A draft: recompute if the discount or rate moved.
  if old.state = 'draft' and new.state = 'draft' then
    if row(new.discount_type, new.discount_value, new.tax_rate)
       is distinct from row(old.discount_type, old.discount_value, old.tax_rate) then
      new.updated_at := now();
      -- Totals are recomputed after the row is written (see below).
    end if;
    return new;
  end if;

  -- Leaving draft is issue_invoice()'s job; it sets number + issued_on.
  -- Anything that is not a draft may only change state (to paid/void),
  -- delivery fields, internal notes and the void fields.
  if old.state <> 'draft' and (
       row(new.customer_id, new.subscription_id, new.type, new.number, new.issued_on,
           new.due_on, new.discount_label, new.discount_type, new.discount_value,
           new.subtotal, new.discount_amount, new.tax_rate, new.tax_amount, new.total)
       is distinct from
       row(old.customer_id, old.subscription_id, old.type, old.number, old.issued_on,
           old.due_on, old.discount_label, old.discount_type, old.discount_value,
           old.subtotal, old.discount_amount, old.tax_rate, old.tax_amount, old.total)) then
    raise exception 'invoice % is %, its content is frozen — void and reissue', old.number, old.state
      using errcode = 'check_violation';
  end if;

  if old.state = 'void' and new.state <> 'void' then
    raise exception 'invoice % is void and cannot be revived', old.number
      using errcode = 'check_violation';
  end if;
  if old.state = 'paid' and new.state = 'void' then
    raise exception 'invoice % is paid; record a refund or an adjustment instead', old.number
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists invoices_guard_trigger on invoices;
create trigger invoices_guard_trigger
  before update on invoices
  for each row execute function invoices_guard();

-- A draft is discarded, not voided: it has no number, so there is nothing to
-- keep. Anything numbered stays forever.
create or replace function invoices_guard_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.state <> 'draft' then
    raise exception 'invoice % is %, it cannot be deleted — void it', old.number, old.state
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists invoices_guard_delete_trigger on invoices;
create trigger invoices_guard_delete_trigger
  before delete on invoices
  for each row execute function invoices_guard_delete();

-- Recompute after a draft's discount/rate change lands (AFTER, so the new
-- values are visible to the function).
create or replace function invoices_recalculate_after()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.state = 'draft' and row(new.discount_type, new.discount_value, new.tax_rate)
     is distinct from row(old.discount_type, old.discount_value, old.tax_rate) then
    perform refresh_invoice_totals(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists invoices_recalculate_trigger on invoices;
create trigger invoices_recalculate_trigger
  after update on invoices
  for each row execute function invoices_recalculate_after();

-- Verify: expect the four triggers.
select tgname from pg_trigger
 where tgrelid in ('invoices'::regclass, 'invoice_lines'::regclass) and not tgisinternal
 order by tgname;


-- ── Block 5: issuing, numbering, voiding ────────────────────────────────────
--
-- BT-YYYY-NNNN. One counter row per year, locked for the duration of the
-- issue so two admins cannot take the same number. Assigned only here, only
-- to a draft, and never given back: a void invoice keeps its number and the
-- counter never moves backwards.

create table if not exists invoice_sequences (
  year  integer primary key,
  last  integer not null default 0
);

alter table invoice_sequences enable row level security;
revoke all on table invoice_sequences from anon, authenticated;
grant select, insert, update on table invoice_sequences to service_role;

create or replace function issue_invoice(p_invoice_id uuid, p_issued_on date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state  invoice_state;
  v_year   integer := extract(year from p_issued_on);
  v_next   integer;
  v_prefix text;
  v_number text;
begin
  select state into v_state from invoices where id = p_invoice_id for update;
  if v_state is null then
    raise exception 'invoice % not found', p_invoice_id;
  end if;
  if v_state <> 'draft' then
    raise exception 'invoice % is already %', p_invoice_id, v_state using errcode = 'check_violation';
  end if;

  perform refresh_invoice_totals(p_invoice_id);

  insert into invoice_sequences (year, last) values (v_year, 0) on conflict (year) do nothing;
  update invoice_sequences set last = last + 1 where year = v_year returning last into v_next;

  select invoice_prefix into v_prefix from billing_settings where id = true;
  v_number := format('%s-%s-%s', v_prefix, v_year, lpad(v_next::text, 4, '0'));

  -- The guard trigger allows this transition because old.state is 'draft'.
  update invoices
     set state = 'sent', number = v_number, issued_on = p_issued_on,
         due_on = coalesce(due_on, p_issued_on)
   where id = p_invoice_id;

  return v_number;
end;
$$;

create or replace function void_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_state invoice_state;
begin
  select state into v_state from invoices where id = p_invoice_id for update;
  if v_state is null then raise exception 'invoice % not found', p_invoice_id; end if;
  if v_state = 'void' then return; end if;
  if v_state = 'draft' then
    raise exception 'invoice is a draft; delete it instead of voiding' using errcode = 'check_violation';
  end if;
  if v_state = 'paid' then
    raise exception 'invoice is paid; record a refund or an adjustment instead' using errcode = 'check_violation';
  end if;
  update invoices
     set state = 'void', voided_at = now(), void_reason = p_reason
   where id = p_invoice_id;
end;
$$;

revoke all on function issue_invoice(uuid, date) from public;
revoke all on function void_invoice(uuid, text) from public;
revoke all on function refresh_invoice_totals(uuid) from public;
grant execute on function issue_invoice(uuid, date) to service_role;
grant execute on function void_invoice(uuid, text) to service_role;
grant execute on function refresh_invoice_totals(uuid) to service_role;

-- Verify: expect the three functions.
select proname from pg_proc
 where proname in ('issue_invoice', 'void_invoice', 'refresh_invoice_totals') order by 1;


-- ── Block 6: payments ───────────────────────────────────────────────────────
--
-- Partial payments are allowed. An invoice becomes paid when what has been
-- recorded against it covers its total; the check runs on every payment.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('bank_transfer', 'cash', 'cheque');
  end if;
end $$;

create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices(id) on delete restrict,
  customer_id  uuid not null references customers(id) on delete restrict,
  amount       numeric(12,2) not null check (amount > 0),
  paid_on      date not null default current_date,
  method       payment_method not null,
  reference    text,
  notes        text,
  created_at   timestamptz not null default now(),
  created_by   uuid
);

create index if not exists payments_invoice_idx on payments (invoice_id);
create index if not exists payments_customer_idx on payments (customer_id, paid_on desc);

alter table payments enable row level security;
revoke all on table payments from anon, authenticated;
grant select, insert on table payments to service_role;

create or replace function payments_settle_invoice()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_total numeric(12,2); v_paid numeric(12,2); v_state invoice_state;
begin
  select total, state into v_total, v_state from invoices where id = new.invoice_id;
  if v_state not in ('sent', 'paid') then
    raise exception 'payments can only be recorded against an issued invoice (this one is %)', v_state
      using errcode = 'check_violation';
  end if;
  select coalesce(sum(amount), 0) into v_paid from payments where invoice_id = new.invoice_id;
  if v_paid >= v_total and v_state = 'sent' then
    update invoices set state = 'paid' where id = new.invoice_id;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_settle on payments;
create trigger payments_settle
  after insert on payments
  for each row execute function payments_settle_invoice();

-- Verify: expect the trigger.
select tgname from pg_trigger where tgrelid = 'payments'::regclass and not tgisinternal;


-- ── Block 7: notes and the change log ───────────────────────────────────────

create table if not exists billing_notes (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete restrict,
  body         text not null,
  created_at   timestamptz not null default now(),
  created_by   uuid
);
create index if not exists billing_notes_customer_idx on billing_notes (customer_id, created_at desc);

-- Every override, every status change, every issue/void/payment. Written by
-- the application alongside the change it describes. Append-only.
create table if not exists billing_events (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references customers(id) on delete restrict,
  subscription_id  uuid references subscriptions(id) on delete restrict,
  invoice_id       uuid references invoices(id) on delete restrict,
  kind             text not null,        -- 'status_change' | 'override' | 'invoice_issued' | 'invoice_voided' | 'payment' | 'subscription_created' | ...
  field            text,                 -- for overrides: which value
  old_value        text,
  new_value        text,
  reason           text,
  created_at       timestamptz not null default now(),
  actor_id         uuid
);
create index if not exists billing_events_customer_idx on billing_events (customer_id, created_at desc);

alter table billing_notes enable row level security;
alter table billing_events enable row level security;
revoke all on table billing_notes, billing_events from anon, authenticated;
grant select, insert on table billing_notes, billing_events to service_role;

-- Customer status is the existing text column. Pin its vocabulary. Overdue is
-- derived (see the view), so the column itself only ever holds the two
-- manual states.
alter table customers drop constraint if exists customers_status_check;
alter table customers add constraint customers_status_check
  check (status in ('active', 'suspended'));
alter table customers add column if not exists suspended_at timestamptz;

-- Verify: expect two tables with RLS on, and the constraint.
select relname, relrowsecurity from pg_class where relname in ('billing_notes', 'billing_events');
select conname from pg_constraint where conname = 'customers_status_check';


-- ── Block 8: the billing table, as one view ─────────────────────────────────
--
-- One row per customer with everything the top-level page and the summary
-- strip need, so they are one query each. Status here is the derived one:
-- suspended (manual) beats overdue (any sent invoice past due) beats active.
-- Thresholds come from billing_settings at query time.

create or replace view customer_billing_summary as
with s as (select * from billing_settings where id = true),
sub as (
  select customer_id,
         count(*)                                        as subscription_count,
         sum(sensor_count + addon_count)                 as sensor_count,
         min(renewal_date)                               as next_renewal,
         sum(term_total)                                 as term_total,
         round(sum(term_total / term_months * 12), 2)    as annualised,
         max(tier::text)                                 as tier,
         max(term_months)                                as term_months
    from subscriptions where ended_at is null group by customer_id
),
inv as (
  select i.customer_id,
         sum(i.total) filter (where i.state = 'sent')                                       as outstanding,
         sum(i.total) filter (where i.state = 'sent' and i.due_on < current_date)           as overdue_amount,
         max(current_date - i.due_on) filter (where i.state = 'sent' and i.due_on < current_date) as days_overdue,
         bool_or(i.state = 'sent' and i.type = 'onboarding')                                as awaiting_first_payment
    from invoices i group by i.customer_id
),
pay as (
  select customer_id, max(paid_on) as last_payment_on from payments group by customer_id
)
select c.id                                        as customer_id,
       c.name,
       c.email,
       case when c.status = 'suspended' then 'suspended'
            when coalesce(inv.overdue_amount, 0) > 0 then 'overdue'
            else 'active' end                        as billing_status,
       c.suspended_at,
       sub.tier,
       sub.subscription_count,
       coalesce(sub.sensor_count, 0)                 as sensor_count,
       sub.term_months,
       sub.term_total,
       coalesce(sub.annualised, 0)                   as annualised,
       sub.next_renewal,
       (sub.next_renewal - current_date)             as days_to_renewal,
       coalesce(inv.outstanding, 0)                  as outstanding,
       coalesce(inv.overdue_amount, 0)               as overdue_amount,
       coalesce(inv.days_overdue, 0)                 as days_overdue,
       coalesce(inv.days_overdue, 0) >= s.suspension_after_days
         and c.status <> 'suspended'                 as suspension_candidate,
       coalesce(inv.awaiting_first_payment, false)   as awaiting_first_payment,
       sub.next_renewal is not null
         and sub.next_renewal - current_date <= s.renewal_notice_days
         and sub.next_renewal >= current_date
         -- A renewal invoice already drafted or issued inside the notice window
         -- (plus a week's slack) clears the item. Drafts count by creation day.
         and not exists (
           select 1 from invoices r
            where r.customer_id = c.id and r.type = 'renewal'
              and r.state in ('draft', 'sent', 'paid')
              and coalesce(r.issued_on, r.created_at::date)
                    >= current_date - s.renewal_notice_days - 7
         )                                           as renewal_needs_invoice,
       pay.last_payment_on
  from customers c
  cross join s
  left join sub on sub.customer_id = c.id
  left join inv on inv.customer_id = c.id
  left join pay on pay.customer_id = c.id;

revoke all on customer_billing_summary from anon, authenticated;
grant select on customer_billing_summary to service_role;

-- Verify: expect one row per customer, billing_status 'active' for all today.
select name, billing_status, sensor_count, outstanding, next_renewal from customer_billing_summary order by name;
