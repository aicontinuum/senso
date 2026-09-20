-- Billing: outstanding and overdue are balances, not invoice totals.
--
-- A part-paid invoice counts for what is still owed on it. The view keeps
-- every column it had (a view's columns cannot be dropped in place), so the
-- two type-based flags remain although the app no longer reads them.

-- ── Block 1 ─────────────────────────────────────────────────────────────────

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
paid as (
  select invoice_id, sum(amount) as amount from payments group by invoice_id
),
inv as (
  select i.customer_id,
         sum(greatest(i.total - coalesce(p.amount, 0), 0)) filter (where i.state = 'sent')
           as outstanding,
         sum(greatest(i.total - coalesce(p.amount, 0), 0)) filter (where i.state = 'sent' and i.due_on < current_date)
           as overdue_amount,
         max(current_date - i.due_on) filter (where i.state = 'sent' and i.due_on < current_date) as days_overdue,
         bool_or(i.state = 'sent' and i.type = 'onboarding')                                as awaiting_first_payment
    from invoices i
    left join paid p on p.invoice_id = i.id
   group by i.customer_id
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

-- Verify: expect one row per customer; outstanding is the balance still owed.
select name, billing_status, outstanding, overdue_amount from customer_billing_summary order by name;
