import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@senso/ui';
import { createAdminClient } from '@/lib/supabase/admin';
import { toCustomerBilling } from '@/lib/billing/overview';
import { formatDate, formatMoney } from '@/lib/format';
import { BillingStatusBadge } from '@/components/billing/BillingStatusBadge';
import type { CustomerBillingSummaryRow } from '@/types/billing';

// Customer billing detail. This is the landing point for every row and every
// Needs Action item; the plan and term blocks, invoice history, payments,
// one-off charges, notes and suspension control are built onto it next.

export default async function CustomerBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('customer_billing_summary')
    .select('*')
    .eq('customer_id', id)
    .maybeSingle();
  if (error) throw new Error(`customer_billing_summary: ${error.message}`);
  if (!data) notFound();

  const customer = toCustomerBilling(data as CustomerBillingSummaryRow);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Billing
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <BillingStatusBadge status={customer.status} />
        </div>
        {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
      </div>

      <Card className="grid grid-cols-2 gap-y-4 px-4 py-4 text-sm sm:grid-cols-4 sm:px-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
          <p className={`mt-0.5 font-medium tabular-nums ${customer.overdueAmount > 0 ? 'text-alert-text' : ''}`}>
            {formatMoney(customer.outstanding)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Annualised</p>
          <p className="mt-0.5 font-medium tabular-nums">{formatMoney(customer.annualised)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Next renewal</p>
          <p className="mt-0.5 font-medium">{formatDate(customer.nextRenewal)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Last payment</p>
          <p className="mt-0.5 font-medium">{formatDate(customer.lastPaymentOn)}</p>
        </div>
      </Card>

      <p className="text-sm text-muted-foreground">
        Plan, term, invoices, payments and notes are the next step of the billing build.
      </p>
    </div>
  );
}
