import { notFound } from 'next/navigation';
import { Card } from '@senso/ui';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerBillingDetail } from '@/lib/billing/detail';
import { formatDate, formatMoney } from '@/lib/format';
import { CustomerBillingHeader } from '@/components/billing/CustomerBillingHeader';
import { SubscriptionsSection } from '@/components/billing/SubscriptionsSection';
import { InvoicesSection } from '@/components/billing/InvoicesSection';
import { BillingEventsSection } from '@/components/billing/BillingEventsSection';

// One customer's money, top to bottom: the header with suspend / reactivate,
// the headline figures, their plan and term, every invoice (each a link to
// its own page), and the log of who changed what. Each card
// owns its own editing state.

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
  const { now, customer, settings, subscriptions, invoices, events } = detail;

  return (
    <div className="space-y-6">
      <CustomerBillingHeader customer={customer} />

      <Card className="grid grid-cols-2 gap-y-4 px-4 py-4 text-sm sm:grid-cols-4 sm:px-6">
        <Headline label="Outstanding" tone={customer.overdueAmount > 0 ? 'text-alert-text' : undefined}>{formatMoney(customer.outstanding)}</Headline>
        <Headline label="Overdue" tone={customer.overdueAmount > 0 ? 'text-alert-text' : undefined}>
          {customer.overdueAmount > 0 ? `${formatMoney(customer.overdueAmount)} · ${customer.daysOverdue} days` : '—'}
        </Headline>
        <Headline label="Annualised Exp. Rev">{formatMoney(customer.annualised)}</Headline>
        <Headline label="Last payment">{formatDate(customer.lastPaymentOn)}</Headline>
      </Card>

      <SubscriptionsSection customerId={customer.customerId} settings={settings} subscriptions={subscriptions} installedSensors={customer.installedSensors} now={now} />
      <InvoicesSection customerId={customer.customerId} invoices={invoices} />
      <BillingEventsSection events={events} />
    </div>
  );
}
