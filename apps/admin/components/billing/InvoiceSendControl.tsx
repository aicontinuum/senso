'use client';

import { useState } from 'react';
import { Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { InlinePanel } from '@/components/billing/InlinePanel';

// The "send this invoice" confirmation: who it goes to, editable, then one
// click. Recipients default to the customer's account email. Several can be
// given, comma-separated.

type Props = { invoiceId: string; label: string; defaultTo: string | null; resend: boolean; onSent: () => void; onCancel: () => void };

export function InvoiceSendControl({ invoiceId, label, defaultTo, resend, onSent, onCancel }: Props) {
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
    <InlinePanel
      title={`${resend ? 'Resend' : 'Email'} ${label}`}
      description="Sent as a PDF attachment, with the billing email as reply-to. Separate several addresses with commas."
      error={error}
      confirmLabel={resend ? 'Resend invoice' : 'Send invoice'}
      busyLabel="Sending…"
      busy={busy}
      disabled={to.trim() === ''}
      onConfirm={send}
      onCancel={onCancel}
    >
      <Input
        label="Send to"
        type="text"
        value={to}
        onChange={e => setTo(e.target.value)}
        placeholder="billing@customer.com, owner@customer.com"
        wrapperClassName="sm:max-w-lg"
      />
    </InlinePanel>
  );
}
