'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { InvoiceDraftEditor } from '@/components/billing/InvoiceDraftEditor';
import { IssuedInvoiceEditor } from '@/components/billing/IssuedInvoiceEditor';
import { InvoiceRow } from '@/components/billing/InvoiceRow';
import type { BillingSettings, Invoice, Subscription } from '@/types/billing';

// Invoice history and the work done on it. "New invoice" opens an empty
// draft straight away; the plan fills it with one click inside. Everything
// else (issue, PDF, send, payments, void, corrections) lives on the row.

type Props = {
  customerId: string;
  customerEmail: string | null;
  settings: BillingSettings;
  subscriptions: Subscription[];
  invoices: Invoice[];
  now: number;
};

const TH = 'px-4 py-3 font-medium sm:px-5';

export function InvoicesSection({ customerId, customerEmail, settings, subscriptions, invoices, now }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function create() {
    setError('');
    setCreating(true);
    const result = await callApi<{ invoiceId: string }>(`/api/billing/customers/${customerId}/invoices`, 'POST', {});
    setCreating(false);
    if (!result.ok) { setError(result.error); return; }
    setEditingId(result.data.invoiceId);
    router.refresh();
  }

  const close = () => { setEditingId(null); router.refresh(); };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <div className="flex items-baseline gap-2">
          <CardTitle>Invoices</CardTitle>
          <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{invoices.length}</span>
        </div>
        <Button size="sm" onClick={create} disabled={creating}>
          <Plus className="size-4" />
          {creating ? 'Opening…' : 'New invoice'}
        </Button>
      </CardHeader>

      {error && <p role="alert" className="px-5 pt-4 text-sm text-alert-text">{error}</p>}

      {invoices.length === 0 ? (
        <div className="m-5 rounded-inner border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">New invoice opens a draft; one click fills it from the plan.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-muted-foreground">
                <th className={TH}>Number</th>
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
                  customerId={customerId}
                  customerEmail={customerEmail}
                  now={now}
                  editing={editingId === inv.id}
                  onEdit={() => { setError(''); setEditingId(inv.id); }}
                  onChanged={close}
                  editor={inv.state === 'draft'
                    ? <InvoiceDraftEditor invoice={inv} settings={settings} subscriptions={subscriptions} invoices={invoices} now={now} onSaved={close} onCancel={() => setEditingId(null)} />
                    : <IssuedInvoiceEditor invoice={inv} onSaved={close} onCancel={() => setEditingId(null)} />}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
