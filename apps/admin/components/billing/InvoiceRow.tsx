'use client';

import { useState } from 'react';
import { Ban, Download, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/lib/billing/constants';
import { InvoiceStateBadge } from '@/components/billing/InvoiceStateBadge';
import { InlinePanel } from '@/components/billing/InlinePanel';
import { InvoiceSendControl } from '@/components/billing/InvoiceSendControl';
import { InvoiceVoidControl } from '@/components/billing/InvoiceVoidControl';
import { InvoicePaymentControl } from '@/components/billing/InvoicePaymentControl';
import type { Invoice } from '@/types/billing';

// One invoice in the history, with the actions its state allows. Each state
// has at most one filled button, the thing you most likely came to do: open
// a draft, or record a payment on an open invoice. Sending is the secondary
// verb; PDF, Edit and the destructive Discard / Void are icon buttons, the
// same vocabulary as the Sensors and Gateways cards. Recording a payment
// always goes through the panel, prefilled with the balance, today and bank
// transfer, so nothing is assumed out of sight. Every panel (payment, send,
// void, discard, the editor) opens in the same sunken row under the invoice,
// and payments and sends are listed there once done.

type Props = {
  invoice: Invoice;
  customerId: string;
  customerEmail: string | null;
  now: number;
  editing: boolean;
  onEdit: () => void;
  onChanged: () => void;
  editor: React.ReactNode;
};

const TD = 'px-4 py-3 sm:px-5';
const NOTE = `${TD} pt-0 text-xs text-muted-foreground`;
export const INVOICE_COLS = 7;

type Panel = 'void' | 'delete' | 'send' | 'payment' | null;

// Every panel opens in the same sunken full-width row under the invoice.
function PanelRow({ children }: { children: React.ReactNode }) {
  return <tr className="bg-sunken"><td colSpan={INVOICE_COLS} className={`${TD} py-4`}>{children}</td></tr>;
}

export function InvoiceRow({ invoice, customerId, customerEmail, now, editing, onEdit, onChanged, editor }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function discard() {
    setBusy(true);
    setError('');
    const result = await callApi(`/api/billing/invoices/${invoice.id}`, 'DELETE');
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setPanel(null);
    onChanged();
  }

  const label = invoice.number ?? 'Draft';
  const draft = invoice.state === 'draft';
  const open = invoice.state === 'sent';
  const issued = open || invoice.state === 'paid';
  const openPanel = (next: Panel) => () => { setError(''); setPanel(next); };
  const close = () => setPanel(null);
  const done = () => { setPanel(null); onChanged(); };

  return (
    <>
      <tr className={editing ? 'bg-sunken' : undefined}>
        <td className={`${TD} whitespace-nowrap font-medium`}>{label}</td>
        <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{formatDate(invoice.issuedOn)}</td>
        <td className={`${TD} whitespace-nowrap ${invoice.overdue ? 'font-medium text-alert-text' : 'text-muted-foreground'}`}>{formatDate(invoice.dueOn)}</td>
        <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{formatMoney(invoice.total)}</td>
        <td className={`${TD} whitespace-nowrap text-right tabular-nums text-muted-foreground`}>{invoice.paid > 0 ? formatMoney(invoice.paid) : '—'}</td>
        <td className={TD}><InvoiceStateBadge invoice={invoice} /></td>
        <td className={`${TD} text-right`}>
          {panel === null && (
            <span className="flex items-center justify-end gap-1">
              <Button asChild variant="ghost" size="icon" aria-label={`Download ${label} as PDF`} title="Download PDF">
                <a href={`/api/billing/invoices/${invoice.id}/pdf`}><Download className="size-4" /></a>
              </Button>
              {issued && !editing && (
                <Button variant="ghost" size="icon" aria-label={`Edit ${label}`} title="Edit wording" onClick={onEdit}>
                  <Pencil className="size-4" />
                </Button>
              )}
              {draft && !editing && (
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
                  {invoice.sentAt ? 'Resend' : 'Send'}
                </Button>
              )}
              {open && <Button size="sm" onClick={openPanel('payment')}>Record payment</Button>}
              {draft && !editing && (
                <Button variant="secondary" size="sm" className="ml-1" onClick={onEdit}>
                  <Pencil className="size-4" />
                  Open draft
                </Button>
              )}
            </span>
          )}
        </td>
      </tr>
      {panel !== null && (
        <PanelRow>
          {panel === 'payment' && (
            <InvoicePaymentControl invoice={invoice} customerId={customerId} now={now} onDone={done} onCancel={close} />
          )}
          {panel === 'send' && (
            <InvoiceSendControl invoiceId={invoice.id} label={label} defaultTo={customerEmail} resend={invoice.sentAt !== null} onSent={done} onCancel={close} />
          )}
          {panel === 'void' && (
            <InvoiceVoidControl invoiceId={invoice.id} label={label} onDone={done} onCancel={close} />
          )}
          {panel === 'delete' && (
            <InlinePanel
              title="Discard this draft?"
              description="Nothing has been issued or numbered; the draft is deleted."
              error={error}
              confirmLabel="Discard draft"
              busyLabel="Discarding…"
              busy={busy}
              danger
              onConfirm={discard}
              onCancel={close}
            />
          )}
        </PanelRow>
      )}
      {editing && <PanelRow>{editor}</PanelRow>}
      {invoice.payments.map(p => (
        <tr key={p.id}><td colSpan={INVOICE_COLS} className={NOTE}>
          Paid {formatMoney(p.amount)} on {formatDate(p.paidOn)} by {PAYMENT_METHOD_LABEL[p.method].toLowerCase()}{p.reference ? ` · ref ${p.reference}` : ''}
        </td></tr>
      ))}
      {invoice.sentAt && (
        <tr><td colSpan={INVOICE_COLS} className={NOTE}>Emailed {formatDate(invoice.sentAt)} to {(invoice.sentTo ?? []).join(', ')}</td></tr>
      )}
      {invoice.state === 'void' && (
        <tr><td colSpan={INVOICE_COLS} className={NOTE}>Voided {formatDate(invoice.voidedAt)}{invoice.voidReason ? `: ${invoice.voidReason}` : ''}</td></tr>
      )}
    </>
  );
}
