'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, ChevronLeft, Download, Send, Trash2 } from 'lucide-react';
import { Button, Card } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { billingDetailHref } from '@/lib/billing/constants';
import { InvoiceStateBadge } from '@/components/billing/InvoiceStateBadge';
import { InlinePanel } from '@/components/billing/InlinePanel';
import { InvoicePaymentControl } from '@/components/billing/InvoicePaymentControl';
import { InvoiceSendControl } from '@/components/billing/InvoiceSendControl';
import { InvoiceVoidControl } from '@/components/billing/InvoiceVoidControl';
import type { Invoice } from '@/types/billing';

// The invoice page header: back to the customer, the number and state, and
// the actions this state allows. Each state has at most one filled button:
// Record payment on an open invoice; a draft's filled button is Issue, which
// lives in the editor because it saves the lines first. PDF is on every
// state. Confirmations open in one inline panel under the header.

type Props = {
  invoice: Invoice;
  customer: { id: string; name: string; email: string | null };
  now: number;
};

type Panel = 'payment' | 'send' | 'void' | 'delete' | null;

export function InvoiceHeader({ invoice, customer, now }: Props) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const label = invoice.number ?? 'Draft invoice';
  const draft = invoice.state === 'draft';
  const open = invoice.state === 'sent';
  const issued = open || invoice.state === 'paid';
  const backHref = billingDetailHref(customer.id);

  const openPanel = (next: Panel) => () => { setError(''); setPanel(next); };
  const close = () => setPanel(null);
  const done = () => { setPanel(null); router.refresh(); };

  async function discard() {
    setBusy(true);
    setError('');
    const result = await callApi(`/api/billing/invoices/${invoice.id}`, 'DELETE');
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    router.push(backHref);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={backHref}><ChevronLeft className="size-4" />{customer.name}</Link>
        </Button>
        {/* Title and subtitle are one block so that on a phone, where the
            actions wrap, they wrap below both rather than between them. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{label}</h1>
              <InvoiceStateBadge invoice={invoice} />
            </div>
            <p className="text-sm text-muted-foreground">
              {customer.name}{customer.email ? ` · ${customer.email}` : ''}
            </p>
          </div>
          {panel === null && (
            <span className="ml-auto flex items-center gap-1">
              <Button asChild variant="ghost" size="icon" aria-label={`Download ${label} as PDF`} title="Download PDF">
                <a href={`/api/billing/invoices/${invoice.id}/pdf`}><Download className="size-4" /></a>
              </Button>
              {draft && (
                <Button variant="ghost" size="icon" aria-label="Discard this draft" title="Discard" className="hover:text-alert-text" onClick={openPanel('delete')}>
                  <Trash2 className="size-4" />
                </Button>
              )}
              {open && (
                <Button variant="ghost" size="icon" aria-label={`Void ${label}`} title="Void" className="hover:text-alert-text" onClick={openPanel('void')}>
                  <Ban className="size-4" />
                </Button>
              )}
              {issued && (
                <Button variant={open ? 'secondary' : 'ghost'} size="sm" className="ml-1" onClick={openPanel('send')}>
                  <Send className="size-4" />
                  {invoice.sentAt ? 'Resend' : 'Send'}
                </Button>
              )}
              {open && <Button size="sm" onClick={openPanel('payment')}>Record payment</Button>}
            </span>
          )}
        </div>
      </div>

      {panel !== null && (
        <Card tone="sunken" className="p-5">
          {panel === 'payment' && (
            <InvoicePaymentControl invoice={invoice} customerId={customer.id} now={now} onDone={done} onCancel={close} />
          )}
          {panel === 'send' && (
            <InvoiceSendControl invoiceId={invoice.id} label={label} defaultTo={customer.email} resend={invoice.sentAt !== null} onSent={done} onCancel={close} />
          )}
          {panel === 'void' && (
            <InvoiceVoidControl invoiceId={invoice.id} label={label} onDone={done} onCancel={close} />
          )}
          {panel === 'delete' && (
            <InlinePanel
              title="Discard this draft?"
              description="Nothing has been issued or numbered; the draft is deleted and you return to the customer."
              error={error}
              confirmLabel="Discard draft"
              busyLabel="Discarding…"
              busy={busy}
              danger
              onConfirm={discard}
              onCancel={close}
            />
          )}
        </Card>
      )}
    </div>
  );
}
