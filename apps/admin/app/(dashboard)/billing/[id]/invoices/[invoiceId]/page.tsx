import { notFound } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '@senso/ui';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadInvoicePage } from '@/lib/billing/invoice-page';
import { InvoiceHeader } from '@/components/billing/InvoiceHeader';
import { InvoiceSummaryCard } from '@/components/billing/InvoiceSummaryCard';
import { InvoiceLinesCard } from '@/components/billing/InvoiceLinesCard';
import { InvoiceDraftEditor } from '@/components/billing/InvoiceDraftEditor';
import { InvoiceHistoryCard } from '@/components/billing/InvoiceHistoryCard';

// One invoice. A draft is its editor; an issued one is its figures, its
// lines and its history. The header carries the actions for either.

export default async function InvoicePage({ params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id: customerId, invoiceId } = await params;
  const data = await loadInvoicePage(createAdminClient(), customerId, invoiceId);
  if (!data) notFound();
  const { now, invoice, customer, settings, subscriptions, invoices, events } = data;

  return (
    <div className="space-y-6">
      <InvoiceHeader invoice={invoice} customer={customer} now={now} />

      {invoice.state === 'draft' ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-hairline"><CardTitle>Draft</CardTitle></CardHeader>
          <div className="px-5 py-4">
            <InvoiceDraftEditor invoice={invoice} settings={settings} subscriptions={subscriptions} invoices={invoices} now={now} />
          </div>
        </Card>
      ) : (
        <>
          <InvoiceSummaryCard invoice={invoice} />
          <InvoiceLinesCard invoice={invoice} />
        </>
      )}

      <InvoiceHistoryCard invoice={invoice} events={events} />
    </div>
  );
}
