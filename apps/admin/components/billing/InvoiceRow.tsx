'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { INVOICE_TYPE_LABEL } from '@/lib/billing/constants';
import { InvoiceStateBadge } from '@/components/billing/InvoiceStateBadge';
import { InvoiceSendControl } from '@/components/billing/InvoiceSendControl';
import type { Invoice } from '@/types/billing';

// One invoice in the history, with the actions its state allows. Every
// invoice has a PDF. A draft can be edited or discarded; an issued one can
// be emailed or voided with a reason. Confirmations open inline, under the row.

type Props = {
  invoice: Invoice;
  customerEmail: string | null;
  editing: boolean;
  onEdit: () => void;
  onChanged: () => void;
  editor: React.ReactNode;
};

const TD = 'px-4 py-3 sm:px-5';
const COLS = 8;

export function InvoiceRow({ invoice, customerEmail, editing, onEdit, onChanged, editor }: Props) {
  const [confirm, setConfirm] = useState<'void' | 'delete' | 'send' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: 'void' | 'delete') {
    setBusy(true);
    setError('');
    const result = action === 'void'
      ? await callApi(`/api/billing/invoices/${invoice.id}/void`, 'POST', { reason })
      : await callApi(`/api/billing/invoices/${invoice.id}`, 'DELETE');
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setConfirm(null);
    onChanged();
  }

  const label = invoice.number ?? 'Draft';
  const issued = invoice.state === 'sent' || invoice.state === 'paid';

  return (
    <>
      <tr className={editing ? 'bg-sunken' : undefined}>
        <td className={`${TD} whitespace-nowrap font-medium`}>{label}</td>
        <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{INVOICE_TYPE_LABEL[invoice.type]}</td>
        <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{formatDate(invoice.issuedOn)}</td>
        <td className={`${TD} whitespace-nowrap ${invoice.overdue ? 'font-medium text-alert-text' : 'text-muted-foreground'}`}>{formatDate(invoice.dueOn)}</td>
        <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{formatMoney(invoice.total)}</td>
        <td className={`${TD} whitespace-nowrap text-right tabular-nums text-muted-foreground`}>{invoice.paid > 0 ? formatMoney(invoice.paid) : '—'}</td>
        <td className={TD}><InvoiceStateBadge invoice={invoice} /></td>
        <td className={`${TD} text-right`}>
          {confirm === 'delete' ? (
            <span className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Discard this draft?</span>
              <Button variant="danger" size="sm" onClick={() => run('delete')} disabled={busy}>{busy ? 'Discarding…' : 'Discard'}</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
            </span>
          ) : confirm === null && (
            <span className="flex justify-end gap-1">
              <Button asChild variant="ghost" size="sm" title="Download PDF">
                <a href={`/api/billing/invoices/${invoice.id}/pdf`}><Download className="size-4" />PDF</a>
              </Button>
              {invoice.state === 'draft' && !editing && <Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>}
              {invoice.state === 'draft' && !editing && <Button variant="ghost" size="sm" className="hover:text-alert-text" onClick={() => setConfirm('delete')}>Discard</Button>}
              {issued && <Button variant="secondary" size="sm" onClick={() => { setError(''); setConfirm('send'); }}>{invoice.sentAt ? 'Resend' : 'Send'}</Button>}
              {invoice.state === 'sent' && <Button variant="ghost" size="sm" className="hover:text-alert-text" onClick={() => { setReason(''); setConfirm('void'); }}>Void</Button>}
            </span>
          )}
        </td>
      </tr>
      {confirm === 'send' && (
        <tr className="bg-sunken">
          <td colSpan={COLS} className={`${TD} py-3`}>
            <InvoiceSendControl invoiceId={invoice.id} label={label} defaultTo={customerEmail} onSent={() => { setConfirm(null); onChanged(); }} onCancel={() => setConfirm(null)} />
          </td>
        </tr>
      )}
      {confirm === 'void' && (
        <tr className="bg-sunken">
          <td colSpan={COLS} className={`${TD} py-3`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Input aria-label="Void reason" value={reason} onChange={e => setReason(e.target.value)} placeholder={`Why ${label} is being voided (kept on the record)`} wrapperClassName="sm:max-w-md" error={error || undefined} />
              <Button variant="danger" size="sm" onClick={() => run('void')} disabled={busy || reason.trim() === ''}>{busy ? 'Voiding…' : `Void ${label}`}</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
            </div>
          </td>
        </tr>
      )}
      {error && confirm !== 'void' && (
        <tr><td colSpan={COLS} className={`${TD} py-2 text-sm text-alert-text`} role="alert">{error}</td></tr>
      )}
      {editing && (
        <tr className="bg-sunken"><td colSpan={COLS} className={`${TD} py-4`}>{editor}</td></tr>
      )}
      {invoice.sentAt && (
        <tr><td colSpan={COLS} className={`${TD} pt-0 text-xs text-muted-foreground`}>Emailed {formatDate(invoice.sentAt)} to {(invoice.sentTo ?? []).join(', ')}</td></tr>
      )}
      {invoice.state === 'void' && invoice.voidReason && (
        <tr><td colSpan={COLS} className={`${TD} pt-0 text-xs text-muted-foreground`}>Voided {formatDate(invoice.voidedAt)}: {invoice.voidReason}</td></tr>
      )}
    </>
  );
}
