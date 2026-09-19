'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, Input, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatMoney, todayIso } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/lib/billing/constants';
import { round2 } from '@/lib/billing/pricing';
import type { Invoice, PaymentMethod } from '@/types/billing';

// Money received, against one issued invoice. The amount defaults to what is
// still owed on it; a smaller figure is a part payment and the invoice stays
// open until the rest arrives.

type Props = { customerId: string; invoices: Invoice[]; now: number };

const METHODS: PaymentMethod[] = ['bank_transfer', 'cash', 'cheque'];

export function RecordPaymentForm({ customerId, invoices, now }: Props) {
  const router = useRouter();
  const open = invoices.filter(i => i.state === 'sent');
  const [invoiceId, setInvoiceId] = useState(open[0]?.id ?? '');
  const [amount, setAmount] = useState(open[0] ? String(round2(open[0].total - open[0].paid)) : '');
  const [paidOn, setPaidOn] = useState(todayIso(now));
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  function pick(id: string) {
    setInvoiceId(id);
    const inv = open.find(i => i.id === id);
    setAmount(inv ? String(round2(inv.total - inv.paid)) : '');
  }

  async function submit() {
    setError('');
    setSaved('');
    setBusy(true);
    const result = await callApi(`/api/billing/customers/${customerId}/payments`, 'POST', { invoiceId, amount, paidOn, method, reference });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setSaved(`Recorded ${formatMoney(Number.parseFloat(amount))}.`);
    setReference('');
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-hairline"><CardTitle>Record payment</CardTitle></CardHeader>
      {open.length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">Nothing is outstanding. Issue an invoice to record a payment against it.</p>
      ) : (
        <div className="space-y-4 px-5 py-5">
          <Select label="Invoice" value={invoiceId} onChange={e => pick(e.target.value)}>
            {open.map(i => (
              <option key={i.id} value={i.id}>{i.number} · {formatMoney(round2(i.total - i.paid))} owed</option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount" type="number" step="0.01" min={0.01} value={amount} onChange={e => setAmount(e.target.value)} />
            <Input label="Date received" type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} />
            <Select label="Method" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
            </Select>
            <Input label="Reference (optional)" value={reference} onChange={e => setReference(e.target.value)} placeholder="Transfer or cheque number" />
          </div>
          {error && <p role="alert" className="text-sm text-alert-text">{error}</p>}
          {saved && <p className="text-sm font-medium text-ok-text">{saved}</p>}
          <Button size="sm" onClick={submit} disabled={busy || invoiceId === '' || amount === ''}>{busy ? 'Recording…' : 'Record payment'}</Button>
        </div>
      )}
    </Card>
  );
}
