'use client';

import { useState } from 'react';
import { Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { InlinePanel } from '@/components/billing/InlinePanel';

// Voiding an issued invoice, with an optional reason kept on the record.
// The number is retired for good; correcting an amount means void and
// reissue, which the panel says so nobody looks for an edit first.

type Props = { invoiceId: string; label: string; onDone: () => void; onCancel: () => void };

export function InvoiceVoidControl({ invoiceId, label, onDone, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setBusy(true);
    const result = await callApi(`/api/billing/invoices/${invoiceId}/void`, 'POST', { reason });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    onDone();
  }

  return (
    <InlinePanel
      title={`Void ${label}?`}
      description="The number is never reused. To change an amount, void this invoice and issue a new one."
      error={error}
      confirmLabel="Void invoice"
      busyLabel="Voiding…"
      busy={busy}
      danger
      onConfirm={submit}
      onCancel={onCancel}
    >
      <Input label="Reason (optional)" hint="Kept in the change log." value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Wrong sensor count" enterKeyHint="done" wrapperClassName="sm:max-w-md" />
    </InlinePanel>
  );
}
