'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { INVOICE_TYPE_LABEL } from '@/lib/billing/constants';
import { InvoiceDraftEditor } from '@/components/billing/InvoiceDraftEditor';
import { InvoiceRow } from '@/components/billing/InvoiceRow';
import { NewInvoiceForm } from '@/components/billing/NewInvoiceForm';
import type { Invoice, InvoiceType, Subscription } from '@/types/billing';

// Invoice history with the work done on it: start a draft, edit it, issue it,
// void an issued one, discard a draft. One-off charges are an adjustment
// invoice with free-text lines. Emailing and the PDF are the next step.

type Props = { customerId: string; subscriptions: Subscription[]; invoices: Invoice[] };

const TH = 'px-4 py-3 font-medium sm:px-5';

export function InvoicesSection({ customerId, subscriptions, invoices }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function create(type: InvoiceType, subscriptionId: string | null) {
    const result = await callApi<{ invoiceId: string }>(`/api/billing/customers/${customerId}/invoices`, 'POST', { type, subscriptionId });
    if (!result.ok) { setError(result.error); return; }
    setCreating(false);
    setEditingId(result.data.invoiceId);
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <div className="flex items-baseline gap-2">
          <CardTitle>Invoices</CardTitle>
          <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{invoices.length}</span>
        </div>
        {!creating && (
          <Button size="sm" onClick={() => { setError(''); setCreating(true); }}>
            <Plus className="size-4" />
            New invoice
          </Button>
        )}
      </CardHeader>

      {creating && (
        <div className="border-b border-hairline px-5 py-4">
          <NewInvoiceForm subscriptions={subscriptions.filter(s => s.endedAt === null)} onCreate={create} onCancel={() => setCreating(false)} />
        </div>
      )}

      {error && <p role="alert" className="px-5 pt-4 text-sm text-alert-text">{error}</p>}

      {invoices.length === 0 ? (
        <div className="m-5 rounded-inner border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {INVOICE_TYPE_LABEL.onboarding} covers hardware and the first term; {INVOICE_TYPE_LABEL.renewal} the next term; {INVOICE_TYPE_LABEL.adjustment} anything one-off.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-muted-foreground">
                <th className={TH}>Number</th>
                <th className={TH}>Type</th>
                <th className={TH}>Issued</th>
                <th className={TH}>Due</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={`${TH} text-right`}>Paid</th>
                <th className={TH}>State</th>
                <th className={`${TH} relative`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {invoices.map(inv => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  editing={editingId === inv.id}
                  onEdit={() => { setError(''); setEditingId(inv.id); }}
                  onChanged={() => { setEditingId(null); router.refresh(); }}
                  editor={
                    <InvoiceDraftEditor invoice={inv} onSaved={() => { setEditingId(null); router.refresh(); }} onCancel={() => setEditingId(null)} />
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
