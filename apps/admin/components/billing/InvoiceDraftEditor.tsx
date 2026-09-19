'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button, Input, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatMoney, plusDays, todayIso } from '@/lib/format';
import { round2 } from '@/lib/billing/pricing';
import type { LineInput } from '@/lib/billing/invoice-lines';
import { InvoiceQuickAdd } from '@/components/billing/InvoiceQuickAdd';
import type { BillingSettings, DiscountType, Invoice, InvoiceType, Subscription } from '@/types/billing';

// A draft, top to bottom: lines (filled from the plan or typed), the add
// buttons, then discount, issue and due dates, and the totals. Totals shown here are a preview; the stored ones are recomputed by
// the database on save and are what the PDF prints. Issuing saves first,
// then numbers the invoice.

type Props = {
  invoice: Invoice;
  settings: BillingSettings;
  subscriptions: Subscription[];
  invoices: Invoice[];
  now: number;
};

type LineDraft = { key: string; description: string; quantity: string; unitAmount: string; amount: string };

function lineFrom(l?: Partial<LineInput> & { id?: string }): LineDraft {
  return {
    key: l?.id ?? crypto.randomUUID(), description: l?.description ?? '',
    quantity: String(l?.quantity ?? 1), unitAmount: String(l?.unitAmount ?? 0), amount: l?.amount === undefined ? '' : String(l.amount),
  };
}

const num = (s: string) => { const n = Number.parseFloat(s); return Number.isFinite(n) ? n : 0; };
const lineAmount = (l: LineDraft) => (l.amount === '' ? round2(num(l.quantity) * num(l.unitAmount)) : num(l.amount));
const GRID = 'sm:grid-cols-[1fr_5rem_7rem_7rem_2rem]';

export function InvoiceDraftEditor({ invoice, settings, subscriptions, invoices, now }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<LineDraft[]>(() => invoice.lines.map(l => lineFrom(l)));
  const [plan, setPlan] = useState<{ subscriptionId: string | null; type: InvoiceType }>({ subscriptionId: invoice.subscriptionId, type: invoice.type });
  const [issuedOn, setIssuedOn] = useState(() => todayIso(now));
  const [dueOn, setDueOn] = useState(() => invoice.dueOn ?? plusDays(todayIso(now), settings.paymentTermsDays));
  const [discountType, setDiscountType] = useState<DiscountType | ''>(invoice.discountType ?? '');
  const [discountValue, setDiscountValue] = useState(invoice.discountValue === null ? '' : String(invoice.discountValue));
  const [discountLabel, setDiscountLabel] = useState(invoice.discountLabel ?? '');
  const [busy, setBusy] = useState<'save' | 'issue' | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const subtotal = round2(lines.reduce((sum, l) => sum + lineAmount(l), 0));
  const discount = discountType === 'amount' ? Math.min(num(discountValue), subtotal)
    : discountType === 'percent' ? round2(subtotal * num(discountValue) / 100) : 0;
  const tax = round2((subtotal - discount) * invoice.taxRate);
  const total = round2(subtotal - discount + tax);

  const updateLine = (key: string, patch: Partial<LineDraft>) => { setSaved(false); setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l))); };

  function addLines(added: LineInput[], fromPlan: { subscriptionId: string; type: InvoiceType } | null) {
    setSaved(false);
    setLines(ls => [...ls, ...added.map(l => lineFrom(l))]);
    if (fromPlan) setPlan(fromPlan);
  }

  // The due date follows the issue date by the payment terms; typing over the
  // due date afterwards is the override.
  function changeIssuedOn(value: string) {
    setIssuedOn(value);
    if (value) setDueOn(plusDays(value, settings.paymentTermsDays));
  }

  async function save(): Promise<boolean> {
    setError('');
    const result = await callApi(`/api/billing/invoices/${invoice.id}`, 'PATCH', {
      dueOn: dueOn || null,
      discountType: discountType || null,
      discountValue: discountType ? discountValue : null,
      discountLabel,
      type: plan.type,
      subscriptionId: plan.subscriptionId,
      lines: lines.filter(l => l.description.trim() !== '').map(l => ({
        description: l.description, quantity: num(l.quantity), unitAmount: num(l.unitAmount), amount: l.amount === '' ? undefined : num(l.amount),
      })),
    });
    if (!result.ok) setError(result.error);
    return result.ok;
  }

  // Save keeps you on the draft with a quiet confirmation; Issue re-renders
  // the page as the issued invoice it has just become.
  async function onSave() {
    setBusy('save');
    setSaved(false);
    if (await save()) { setSaved(true); router.refresh(); }
    setBusy(null);
  }
  async function onIssue() {
    setBusy('issue');
    setSaved(false);
    if (await save()) {
      const result = await callApi(`/api/billing/invoices/${invoice.id}/issue`, 'POST', { issuedOn });
      if (result.ok) router.refresh(); else setError(result.error);
    }
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      {lines.length === 0 ? (
        <div className="rounded-inner border border-dashed px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">No lines yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Add the term from the plan, or type your own below.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={`hidden gap-2 text-xs font-semibold text-muted-foreground sm:grid ${GRID}`}>
            <span>Description</span><span>Qty</span><span>Unit</span><span>Amount</span><span />
          </div>
          {lines.map(l => (
            <div key={l.key} className={`grid gap-2 ${GRID}`}>
              <Input aria-label="Description" value={l.description} onChange={e => updateLine(l.key, { description: e.target.value })} placeholder="What this line is for" />
              <Input aria-label="Quantity" type="number" step="0.01" value={l.quantity} onChange={e => updateLine(l.key, { quantity: e.target.value, amount: '' })} />
              <Input aria-label="Unit amount" type="number" step="0.01" value={l.unitAmount} onChange={e => updateLine(l.key, { unitAmount: e.target.value, amount: '' })} />
              <Input aria-label="Line amount" type="number" step="0.01" value={l.amount} onChange={e => updateLine(l.key, { amount: e.target.value })} placeholder={String(lineAmount(l))} />
              <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      )}

      {/* The add buttons sit under the lines because that is where a new one
          lands; on an empty draft they are the only thing to do first. */}
      <InvoiceQuickAdd settings={settings} subscriptions={subscriptions} invoices={invoices} currentInvoiceId={invoice.id} onAdd={addLines} />

      {lines.length > 0 && (
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Discount" value={discountType} onChange={e => setDiscountType(e.target.value as DiscountType | '')}>
          <option value="">None</option>
          <option value="amount">Amount</option>
          <option value="percent">Percent</option>
        </Select>
        <Input label={discountType === 'percent' ? 'Percent off' : 'Amount off'} type="number" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)} disabled={discountType === ''} />
        <Input label="Discount label" hint="Printed on the PDF line." value={discountLabel} onChange={e => setDiscountLabel(e.target.value)} disabled={discountType === ''} placeholder="e.g. Pilot pricing" />
      </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Issue date" hint="Printed on the invoice; stamped when you issue." type="date" value={issuedOn} onChange={e => changeIssuedOn(e.target.value)} />
        <Input label="Due date" hint={`Issue date plus ${settings.paymentTermsDays} days. Change it if agreed otherwise.`} type="date" value={dueOn} onChange={e => setDueOn(e.target.value)} />
      </div>

      {lines.length > 0 && (
      <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt><dd className="text-right tabular-nums">{formatMoney(subtotal)}</dd>
        {discount > 0 && <><dt className="text-muted-foreground">Discount</dt><dd className="text-right tabular-nums">−{formatMoney(discount)}</dd></>}
        {invoice.taxRate > 0 && <><dt className="text-muted-foreground">Tax ({invoice.taxRate * 100}%)</dt><dd className="text-right tabular-nums">{formatMoney(tax)}</dd></>}
        <dt className="font-semibold">Total</dt><dd className="text-right font-semibold tabular-nums">{formatMoney(total)}</dd>
      </dl>
      )}

      {error && <p role="alert" className="text-sm text-alert-text">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onIssue} disabled={busy !== null || total === 0 || issuedOn === ''}>{busy === 'issue' ? 'Issuing…' : 'Issue invoice'}</Button>
        <Button variant="secondary" size="sm" onClick={onSave} disabled={busy !== null}>{busy === 'save' ? 'Saving…' : 'Save draft'}</Button>
        {saved && <span className="text-sm font-medium text-ok-text">Draft saved.</span>}
      </div>
    </div>
  );
}
