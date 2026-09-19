'use client';

import { useState } from 'react';
import { Button, Card, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import type { Invoice } from '@/types/billing';

// What may still change once an invoice is issued: the words. Line
// descriptions, the due date, and the discount label. Amounts are shown
// read-only so the admin can see what each description belongs to.

type Props = { invoice: Invoice; onSaved: () => void; onCancel: () => void };

export function IssuedInvoiceEditor({ invoice, onSaved, onCancel }: Props) {
  const [descriptions, setDescriptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(invoice.lines.map(l => [l.id, l.description])));
  const [dueOn, setDueOn] = useState(invoice.dueOn ?? '');
  const [discountLabel, setDiscountLabel] = useState(invoice.discountLabel ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    setBusy(true);
    const result = await callApi(`/api/billing/invoices/${invoice.id}`, 'PATCH', {
      dueOn: dueOn || null,
      ...(invoice.discountType ? { discountLabel } : {}),
      lineDescriptions: invoice.lines
        .filter(l => descriptions[l.id] !== l.description)
        .map(l => ({ id: l.id, description: descriptions[l.id] })),
    });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    onSaved();
  }

  return (
    <Card tone="sunken" className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">
        {invoice.number} is issued. Wording and the due date can be corrected; the amounts cannot. Void and reissue for those.
      </p>
      <div className="space-y-2">
        {invoice.lines.map(l => (
          <div key={l.id} className="grid gap-2 sm:grid-cols-[1fr_8rem] sm:items-center">
            <Input aria-label="Description" value={descriptions[l.id] ?? ''} onChange={e => setDescriptions(d => ({ ...d, [l.id]: e.target.value }))} />
            <span className="text-right text-sm tabular-nums text-muted-foreground">{formatMoney(l.amount)}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Due date" type="date" value={dueOn} onChange={e => setDueOn(e.target.value)} />
        {invoice.discountType && (
          <Input label="Discount label" hint={`Printed next to −${formatMoney(invoice.discountAmount)}.`} value={discountLabel} onChange={e => setDiscountLabel(e.target.value)} />
        )}
      </div>
      {error && <p role="alert" className="text-sm text-alert-text">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </Card>
  );
}
