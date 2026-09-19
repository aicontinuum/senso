import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button, Card } from '@senso/ui';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerBillingDetail } from '@/lib/billing/detail';
import { formatDate, formatMoney } from '@/lib/format';
import { BillingStatusBadge } from '@/components/billing/BillingStatusBadge';
import { SubscriptionsSection } from '@/components/billing/SubscriptionsSection';
import { InvoicesSection } from '@/components/billing/InvoicesSection';
import { RecordPaymentForm } from '@/components/billing/RecordPaymentForm';
import { BillingNotesSection } from '@/components/billing/BillingNotesSection';
import { SuspensionControl } from '@/components/billing/SuspensionControl';
import { BillingEventsSection } from '@/components/billing/BillingEventsSection';

// One customer's money, top to bottom: the headline figures, whether they are
// suspended, their plan and term, every invoice, payments in, notes, and the
// log of who changed what. Each card owns its own editing state.

function Headline({ label, tone, children }: { label: string; tone?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-medium tabular-nums ${tone ?? ''}`}>{children}</p>
    </div>
  );
}

export default async function CustomerBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadCustomerBillingDetail(createAdminClient(), id);
  if (!detail) notFound();
  const { now, customer, settings, subscriptions, invoices, notes, events } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/billing"><ChevronLeft className="size-4" />Billing</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <BillingStatusBadge status={customer.status} />
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href={`/customers/${customer.customerId}`}>Customer record</Link>
          </Button>
        </div>
        {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
      </div>

      <Card className="grid grid-cols-2 gap-y-4 px-4 py-4 text-sm sm:grid-cols-4 sm:px-6">
        <Headline label="Outstanding" tone={customer.overdueAmount > 0 ? 'text-alert-text' : undefined}>{formatMoney(customer.outstanding)}</Headline>
        <Headline label="Overdue" tone={customer.overdueAmount > 0 ? 'text-alert-text' : undefined}>
          {customer.overdueAmount > 0 ? `${formatMoney(customer.overdueAmount)} · ${customer.daysOverdue} days` : '—'}
        </Headline>
        <Headline label="Annualised">{formatMoney(customer.annualised)}</Headline>
        <Headline label="Last payment">{formatDate(customer.lastPaymentOn)}</Headline>
      </Card>

      <SuspensionControl customerId={customer.customerId} status={customer.status} suspendedAt={customer.suspendedAt} suspensionCandidate={customer.suspensionCandidate} />

      <SubscriptionsSection customerId={customer.customerId} settings={settings} subscriptions={subscriptions} now={now} />
      <InvoicesSection customerId={customer.customerId} subscriptions={subscriptions} invoices={invoices} />
      <RecordPaymentForm customerId={customer.customerId} invoices={invoices} now={now} />
      <BillingNotesSection customerId={customer.customerId} notes={notes} />
      <BillingEventsSection events={events} />
    </div>
  );
}
