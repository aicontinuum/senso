'use client';

import { useState } from 'react';
import { Input, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatMoney, todayIso } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/lib/billing/constants';
import { balanceOf } from '@/lib/billing/pricing';
import { InlinePanel } from '@/components/billing/InlinePanel';
import type { Invoice, PaymentMethod } from '@/types/billing';

// Money in, with the details: amount (the balance unless typed over, so a
// smaller figure is a part payment), date, method and reference. It opens
// prefilled with the balance, today and bank transfer, so the common case
// is one click to confirm and every assumption is on screen first.

type Props = { invoice: Invoice; customerId: string; now: number; onDone: () => void; onCancel: () => void };

const METHODS: PaymentMethod[] = ['bank_transfer', 'cash', 'cheque'];

export function InvoicePaymentControl({ invoice, customerId, now, onDone, onCancel }: Props) {
  const balance = balanceOf(invoice);
  const [amount, setAmount] = useState(String(balance));
  const [paidOn, setPaidOn] = useState(todayIso(now));
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const partial = Number.parseFloat(amount) < balance;

  async function submit() {
    setError('');
    setBusy(true);
    const result = await callApi(`/api/billing/customers/${customerId}/payments`, 'POST', {
      invoiceId: invoice.id, amount, paidOn, method, reference,
    });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    onDone();
  }

  return (
    <InlinePanel
      title={`Record a payment on ${invoice.number}`}
      description={partial
        ? `Balance ${formatMoney(balance)}. A smaller amount is a part payment; the invoice stays open for the rest.`
        : `Balance ${formatMoney(balance)}. Type a smaller amount to record a part payment.`}
      error={error}
      confirmLabel="Record payment"
      busyLabel="Recording…"
      busy={busy}
      disabled={amount === ''}
      onConfirm={submit}
      onCancel={onCancel}
    >
      <div className="grid gap-3 sm:grid-cols-[8rem_10rem_10rem_1fr]">
        <Input label="Amount" type="number" step="0.01" min={0.01} value={amount} onChange={e => setAmount(e.target.value)} />
        <Input label="Received on" type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} />
        <Select label="Method" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
          {METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
        </Select>
        <Input label="Reference (optional)" value={reference} onChange={e => setReference(e.target.value)} placeholder="Transfer or cheque number" />
      </div>
    </InlinePanel>
  );
}
