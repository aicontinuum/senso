-- Billing: the freeze covers the money, not the words.
--
-- An issued invoice's amounts, totals and number stay immutable. Its line
-- descriptions, due date and discount label may be corrected afterwards: a
-- typo or an agreed extension is not a reason to void and reissue. The
-- void reason becomes optional.
--
-- Run block by block. Each ends in a verification query.

-- ── Block 1: line descriptions may change after issue ───────────────────────

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
    -- Once issued, a line may be reworded and nothing else. The money and the
    -- position stay, and no recompute runs because nothing that feeds a total
    -- has moved.
    if tg_op = 'UPDATE'
       and row(new.invoice_id, new.position, new.quantity, new.unit_amount, new.amount)
           is not distinct from
           row(old.invoice_id, old.position, old.quantity, old.unit_amount, old.amount) then
      return new;
    end if;
    raise exception 'invoice % is %, its amounts are frozen — void and reissue', v_id, v_state
      using errcode = 'check_violation';
  end if;

  perform refresh_invoice_totals(v_id);
  return coalesce(new, old);
end;
$$;

-- Verify: expect the function.
select proname from pg_proc where proname = 'invoice_lines_changed';


-- ── Block 2: due date and discount label may change after issue ─────────────

create or replace function invoices_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.state = 'draft' and new.state = 'draft' then
    if row(new.discount_type, new.discount_value, new.tax_rate)
       is distinct from row(old.discount_type, old.discount_value, old.tax_rate) then
      new.updated_at := now();
    end if;
    return new;
  end if;

  -- Not a draft: the money, the number, the dates of record and the type are
  -- frozen. Due date, discount label, delivery fields, notes and the void
  -- fields may still change.
  if old.state <> 'draft' and (
       row(new.customer_id, new.subscription_id, new.type, new.number, new.issued_on,
           new.discount_type, new.discount_value,
           new.subtotal, new.discount_amount, new.tax_rate, new.tax_amount, new.total)
       is distinct from
       row(old.customer_id, old.subscription_id, old.type, old.number, old.issued_on,
           old.discount_type, old.discount_value,
           old.subtotal, old.discount_amount, old.tax_rate, old.tax_amount, old.total)) then
    raise exception 'invoice % is %, its amounts are frozen — void and reissue', old.number, old.state
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

-- Verify: expect the function.
select proname from pg_proc where proname = 'invoices_guard';
