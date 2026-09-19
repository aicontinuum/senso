'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, ChevronLeft, RotateCcw, UserRound } from 'lucide-react';
import { Button, Card, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { BillingStatusBadge } from '@/components/billing/BillingStatusBadge';
import { InlinePanel } from '@/components/billing/InlinePanel';
import type { CustomerBilling } from '@/types/billing';

// The page header: who this is, their billing status, and the two things you
// can do from here — open the customer record, or suspend / reactivate.
// Suspension is by hand, with a reason, after a confirmation that says what
// it means; the system flags a candidate and never does it on its own. A
// banner appears under the header only when there is something to say: the
// customer is suspended, or is past the threshold and waiting on a decision.

type Props = { customer: Pick<CustomerBilling, 'customerId' | 'name' | 'email' | 'status' | 'suspendedAt' | 'suspensionCandidate'> };

export function CustomerBillingHeader({ customer }: Props) {
  const router = useRouter();
  const suspended = customer.status === 'suspended';
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function apply() {
    setError('');
    setBusy(true);
    const result = await callApi(`/api/billing/customers/${customer.customerId}/status`, 'POST', {
      status: suspended ? 'active' : 'suspended', reason,
    });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setOpen(false);
    setReason('');
    router.refresh();
  }

  const banner = suspended
    ? <><span className="font-semibold">Suspended</span> since {formatDate(customer.suspendedAt)}. Readings keep logging; the portal and reports are locked.</>
    : customer.suspensionCandidate
      ? <><span className="font-semibold text-alert-text">Past the suspension threshold.</span> Suspending is your call; nothing happens until you do.</>
      : null;

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/billing"><ChevronLeft className="size-4" />Billing</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <BillingStatusBadge status={customer.status} />
          <span className="ml-auto flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/customers/${customer.customerId}`}><UserRound className="size-4" />Customer record</Link>
            </Button>
            {!open && (suspended ? (
              <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
                <RotateCcw className="size-4" />Reactivate
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="hover:text-alert-text" onClick={() => setOpen(true)}>
                <Ban className="size-4" />Suspend
              </Button>
            ))}
          </span>
        </div>
        {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
      </div>

      {(banner || open) && (
        <Card className={`overflow-hidden ${suspended ? 'border-offline-border' : customer.suspensionCandidate ? 'border-alert-border' : ''}`}>
          {banner && <p className="px-5 py-4 text-sm">{banner}</p>}
          {open && (
            <div className={`bg-sunken px-5 py-4 ${banner ? 'border-t border-hairline' : ''}`}>
              <InlinePanel
                title={suspended ? `Reactivate ${customer.name}?` : `Suspend ${customer.name}?`}
                description={suspended
                  ? 'Their portal and reports unlock immediately.'
                  : 'They lose the portal and reports until reactivated. Readings and alerts are unaffected.'}
                error={error}
                confirmLabel={suspended ? 'Reactivate customer' : 'Suspend customer'}
                busyLabel="Saving…"
                busy={busy}
                danger={!suspended}
                disabled={reason.trim() === ''}
                onConfirm={apply}
                onCancel={() => { setOpen(false); setError(''); }}
              >
                <Input label="Reason" hint="Kept in the change log." value={reason} onChange={e => setReason(e.target.value)} placeholder={suspended ? 'e.g. Transfer received' : 'e.g. 60 days overdue, no reply'} wrapperClassName="sm:max-w-md" />
              </InlinePanel>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
