'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { InlinePanel } from '@/components/billing/InlinePanel';

// The "are you sure" step for suspending or reactivating a customer, with
// the reason that goes into the change log. Used from the billing page
// header and from the customer page, so the words and the call are one.
// Suspension is by hand, with a reason; the system flags a candidate and
// never does it on its own.

type Props = {
  customerId: string;
  name: string;
  suspended: boolean;
  onDone: () => void;
  onCancel: () => void;
};

export function SuspensionPanel({ customerId, name, suspended, onDone, onCancel }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function apply() {
    setError('');
    setBusy(true);
    const result = await callApi(`/api/billing/customers/${customerId}/status`, 'POST', {
      status: suspended ? 'active' : 'suspended', reason,
    });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    onDone();
    router.refresh();
  }

  return (
    <InlinePanel
      title={suspended ? `Reactivate ${name}?` : `Suspend ${name}?`}
      description={suspended
        ? 'Their next sign-in goes through immediately.'
        : 'They are signed out and cannot sign back in until reactivated. Readings and alerts are unaffected.'}
      error={error}
      confirmLabel={suspended ? 'Reactivate customer' : 'Suspend customer'}
      busyLabel="Saving…"
      busy={busy}
      danger={!suspended}
      disabled={reason.trim() === ''}
      onConfirm={apply}
      onCancel={onCancel}
    >
      <Input label="Reason" hint="Kept in the change log." value={reason} onChange={e => setReason(e.target.value)} placeholder={suspended ? 'e.g. Transfer received' : 'e.g. 60 days overdue, no reply'} enterKeyHint="done" wrapperClassName="sm:max-w-md" />
    </InlinePanel>
  );
}
