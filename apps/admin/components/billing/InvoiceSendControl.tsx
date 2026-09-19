'use client';

import { useState } from 'react';
import { Button, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';

// The "send this invoice" confirmation: who it goes to, editable, then one
// click. Recipients default to the customer's account email. Several can be
// given, comma-separated.

type Props = { invoiceId: string; label: string; defaultTo: string | null; onSent: () => void; onCancel: () => void };

export function InvoiceSendControl({ invoiceId, label, defaultTo, onSent, onCancel }: Props) {
  const [to, setTo] = useState(defaultTo ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setError('');
    setBusy(true);
    const recipients = to.split(',').map(s => s.trim()).filter(Boolean);
    const result = await callApi(`/api/billing/invoices/${invoiceId}/send`, 'POST', { to: recipients });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    onSent();
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Input
        aria-label="Recipients"
        type="text"
        value={to}
        onChange={e => setTo(e.target.value)}
        placeholder="billing@customer.com, owner@customer.com"
        hint={error ? undefined : `Emails ${label} as a PDF. Separate several addresses with commas.`}
        error={error || undefined}
        wrapperClassName="sm:max-w-lg"
      />
      <Button size="sm" className="h-10" onClick={send} disabled={busy || to.trim() === ''}>{busy ? 'Sending…' : `Send ${label}`}</Button>
      <Button variant="ghost" size="sm" className="h-10" onClick={onCancel} disabled={busy}>Cancel</Button>
    </div>
  );
}
