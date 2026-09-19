'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import { round2 } from '@/lib/billing/pricing';
import type { DiscountType, Invoice } from '@/types/billing';

// A draft's contents: lines, discount, due date, internal notes. Totals shown
// here are a preview; the stored ones are recomputed by the database on save
// and are what the PDF prints. Issuing saves first, then numbers the invoice.

type Props = { invoice: Invoice; onSaved: () => void; onCancel: () => void };

type LineDraft = { key: string; description: string; quantity: string; unitAmount: string; amount: string };

function lineFrom(l?: Invoice['lines'][number]): LineDraft {
  return {
    key: l?.id ?? crypto.randomUUID(), description: l?.description ?? '',
    quantity: String(l?.quantity ?? 1), unitAmount: String(l?.unitAmount ?? 0), amount: l ? String(l.amount) : '',
  };
}

const num = (s: string) => { const n = Number.parseFloat(s); return Number.isFinite(n) ? n : 0; };
const lineAmount = (l: LineDraft) => (l.amount === '' ? round2(num(l.quantity) * num(l.unitAmount)) : num(l.amount));

export function InvoiceDraftEditor({ invoice, onSaved, onCancel }: Props) {
  const [lines, setLines] = useState<LineDraft[]>(() => invoice.lines.length ? invoice.lines.map(l => lineFrom(l)) : [lineFrom()]);
  const [dueOn, setDueOn] = useState(invoice.dueOn ?? '');
  const [discountType, setDiscountType] = useState<DiscountType | ''>(invoice.discountType ?? '');
  const [discountValue, setDiscountValue] = useState(invoice.discountValue === null ? '' : String(invoice.discountValue));
  const [discountLabel, setDiscountLabel] = useState(invoice.discountLabel ?? '');
  const [notes, setNotes] = useState(invoice.internalNotes ?? '');
  const [busy, setBusy] = useState<'save' | 'issue' | null>(null);
  const [error, setError] = useState('');

  const subtotal = round2(lines.reduce((sum, l) => sum + lineAmount(l), 0));
  const discount = discountType === 'amount' ? Math.min(num(discountValue), subtotal)
    : discountType === 'percent' ? round2(subtotal * num(discountValue) / 100) : 0;
  const tax = round2((subtotal - discount) * invoice.taxRate);
  const total = round2(subtotal - discount + tax);

  const updateLine = (key: string, patch: Partial<LineDraft>) => setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));

  async function save(): Promise<boolean> {
    setError('');
    const result = await callApi(`/api/billing/invoices/${invoice.id}`, 'PATCH', {
      dueOn: dueOn || null,
      discountType: discountType || null,
      discountValue: discountType ? discountValue : null,
      discountLabel,
      internalNotes: notes,
      lines: lines.filter(l => l.description.trim() !== '').map(l => ({
        description: l.description, quantity: num(l.quantity), unitAmount: num(l.unitAmount), amount: l.amount === '' ? undefined : num(l.amount),
      })),
    });
    if (!result.ok) setError(result.error);
    return result.ok;
  }

  async function onSave() {
    setBusy('save');
    if (await save()) onSaved();
    setBusy(null);
  }

  async function onIssue() {
    setBusy('issue');
    if (await save()) {
      const result = await callApi(`/api/billing/invoices/${invoice.id}/issue`, 'POST', {});
      if (result.ok) onSaved(); else setError(result.error);
    }
    setBusy(null);
  }

  return (
    <Card tone="sunken" className="space-y-4 p-4">
      <div className="space-y-2">
        <div className="hidden gap-2 text-xs font-semibold text-muted-foreground sm:grid sm:grid-cols-[1fr_5rem_7rem_7rem_2rem]">
          <span>Description</span><span>Qty</span><span>Unit</span><span>Amount</span><span />
        </div>
        {lines.map(l => (
          <div key={l.key} className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem_7rem_2rem]">
            <Input aria-label="Description" value={l.description} onChange={e => updateLine(l.key, { description: e.target.value })} placeholder="e.g. Installation visit" />
            <Input aria-label="Quantity" type="number" step="0.01" value={l.quantity} onChange={e => updateLine(l.key, { quantity: e.target.value, amount: '' })} />
            <Input aria-label="Unit amount" type="number" step="0.01" value={l.unitAmount} onChange={e => updateLine(l.key, { unitAmount: e.target.value, amount: '' })} />
            <Input aria-label="Line amount" type="number" step="0.01" value={l.amount} onChange={e => updateLine(l.key, { amount: e.target.value })} placeholder={String(lineAmount(l))} />
            <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setLines(ls => [...ls, lineFrom()])}><Plus className="size-4" />Add line</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Discount" value={discountType} onChange={e => setDiscountType(e.target.value as DiscountType | '')}>
          <option value="">None</option>
          <option value="amount">Amount</option>
          <option value="percent">Percent</option>
        </Select>
        <Input label={discountType === 'percent' ? 'Percent off' : 'Amount off'} type="number" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)} disabled={discountType === ''} />
        <Input label="Discount label" hint="Printed on the PDF line." value={discountLabel} onChange={e => setDiscountLabel(e.target.value)} disabled={discountType === ''} placeholder="e.g. Pilot pricing" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Due date" type="date" value={dueOn} onChange={e => setDueOn(e.target.value)} />
        <Input label="Internal notes" hint="Never printed." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt><dd className="text-right tabular-nums">{formatMoney(subtotal)}</dd>
        {discount > 0 && <><dt className="text-muted-foreground">Discount</dt><dd className="text-right tabular-nums">−{formatMoney(discount)}</dd></>}
        {invoice.taxRate > 0 && <><dt className="text-muted-foreground">Tax ({invoice.taxRate * 100}%)</dt><dd className="text-right tabular-nums">{formatMoney(tax)}</dd></>}
        <dt className="font-semibold">Total</dt><dd className="text-right font-semibold tabular-nums">{formatMoney(total)}</dd>
      </dl>

      {error && <p role="alert" className="text-sm text-alert-text">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onIssue} disabled={busy !== null || total === 0}>{busy === 'issue' ? 'Issuing…' : 'Issue invoice'}</Button>
        <Button variant="secondary" size="sm" onClick={onSave} disabled={busy !== null}>{busy === 'save' ? 'Saving…' : 'Save draft'}</Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy !== null}>Cancel</Button>
      </div>
    </Card>
  );
}
