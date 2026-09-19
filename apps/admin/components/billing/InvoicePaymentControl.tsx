'use client';

import { useState } from 'react';
import { Button, Input, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatMoney, todayIso } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/lib/billing/constants';
import { round2 } from '@/lib/billing/pricing';
import type { Invoice, PaymentMethod } from '@/types/billing';

// Money in, recorded from the invoice row. "Mark paid" takes the balance as
// the amount; "Part payment" lets it be typed. Either way the date, method
// and reference are one line, and the database settles the invoice once the
// recorded total covers it.

type Props = { invoice: Invoice; customerId: string; partial: boolean; now: number; onDone: () => void; onCancel: () => void };

const METHODS: PaymentMethod[] = ['bank_transfer', 'cash', 'cheque'];

export function InvoicePaymentControl({ invoice, customerId, partial, now, onDone, onCancel }: Props) {
  const balance = round2(Math.max(0, invoice.total - invoice.paid));
  const [amount, setAmount] = useState(String(balance));
  const [paidOn, setPaidOn] = useState(todayIso(now));
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setBusy(true);
    const result = await callApi(`/api/billing/customers/${customerId}/payments`, 'POST', {
      invoiceId: invoice.id, amount: partial ? amount : balance, paidOn, method, reference,
    });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    onDone();
  }

  const label = invoice.number ?? 'this invoice';

  return (
    <div className="space-y-2">
      <p className="text-sm">
        {partial
          ? <>Part payment against {label}. Balance {formatMoney(balance)}; the invoice stays open until the rest arrives.</>
          : <>Mark {label} paid in full: {formatMoney(balance)} received.</>}
      </p>
      <div className="grid gap-2 sm:grid-cols-[8rem_10rem_10rem_1fr_auto_auto] sm:items-start">
        <Input aria-label="Amount" type="number" step="0.01" min={0.01} value={amount} onChange={e => setAmount(e.target.value)} disabled={!partial} />
        <Input aria-label="Date received" type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} />
        <Select aria-label="Method" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
          {METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
        </Select>
        <Input aria-label="Reference" value={reference} onChange={e => setReference(e.target.value)} placeholder="Transfer or cheque number (optional)" />
        <Button size="sm" className="h-10" onClick={submit} disabled={busy || amount === ''}>{busy ? 'Recording…' : partial ? 'Record part payment' : 'Confirm paid'}</Button>
        <Button variant="ghost" size="sm" className="h-10" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
      {error && <p role="alert" className="text-sm text-alert-text">{error}</p>}
    </div>
  );
}
