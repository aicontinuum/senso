'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, RotateCcw } from 'lucide-react';
import { Button, Card, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { BillingStatus } from '@senso/types';

// Suspend or reactivate, by hand, with a reason, after a confirmation that
// says what suspension means. The system flags a candidate; it never does
// this on its own.

type Props = { customerId: string; status: BillingStatus; suspendedAt: string | null; suspensionCandidate: boolean };

export function SuspensionControl({ customerId, status, suspendedAt, suspensionCandidate }: Props) {
  const router = useRouter();
  const suspended = status === 'suspended';
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function apply() {
    setError('');
    setBusy(true);
    const result = await callApi(`/api/billing/customers/${customerId}/status`, 'POST', { status: suspended ? 'active' : 'suspended', reason });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setOpen(false);
    setReason('');
    router.refresh();
  }

  return (
    <Card className={`overflow-hidden ${suspended ? 'border-offline-border' : suspensionCandidate ? 'border-alert-border' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="text-sm">
          {suspended ? (
            <p><span className="font-semibold">Suspended</span> since {formatDate(suspendedAt)}. Data keeps logging; the portal and reports are locked.</p>
          ) : suspensionCandidate ? (
            <p><span className="font-semibold text-alert-text">Past the suspension threshold.</span> Suspending is your call; nothing happens until you do.</p>
          ) : (
            <p><span className="font-semibold">Active.</span> Suspending locks the portal and reports; readings keep logging.</p>
          )}
        </div>
        {!open && (
          <Button variant={suspended ? 'secondary' : 'ghost'} size="sm" className={suspended ? '' : 'hover:text-alert-text'} onClick={() => setOpen(true)}>
            {suspended ? <><RotateCcw className="size-4" />Reactivate</> : <><Ban className="size-4" />Suspend</>}
          </Button>
        )}
      </div>
      {open && (
        <div className="space-y-3 border-t border-hairline bg-sunken px-5 py-4">
          <p className="text-sm">
            {suspended
              ? 'Reactivate this customer? Their portal and reports unlock immediately.'
              : 'Suspend this customer? They lose the portal and reports until reactivated. Readings and alerts are unaffected.'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Input aria-label="Reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (kept in the change log)" error={error || undefined} wrapperClassName="sm:max-w-md" />
            <Button variant={suspended ? 'primary' : 'danger'} size="sm" className="h-10" onClick={apply} disabled={busy || reason.trim() === ''}>
              {busy ? 'Saving…' : suspended ? 'Confirm reactivation' : 'Confirm suspension'}
            </Button>
            <Button variant="ghost" size="sm" className="h-10" onClick={() => { setOpen(false); setError(''); }} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
