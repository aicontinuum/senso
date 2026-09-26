'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Ban, ChevronLeft, RotateCcw, UserRound } from 'lucide-react';
import { Button, Card } from '@senso/ui';
import { formatDate } from '@/lib/format';
import { BillingStatusBadge } from '@/components/billing/BillingStatusBadge';
import { SuspensionPanel } from '@/components/billing/SuspensionPanel';
import type { CustomerBilling } from '@/types/billing';

// The page header: who this is, their billing status, and the two things you
// can do from here — open the customer record, or suspend / reactivate
// (the same panel the customer page offers). A banner appears under the
// header only when there is something to say: the customer is suspended,
// or is past the threshold and waiting on a decision.

type Props = { customer: Pick<CustomerBilling, 'customerId' | 'name' | 'email' | 'status' | 'suspendedAt' | 'suspensionCandidate'> };

export function CustomerBillingHeader({ customer }: Props) {
  const suspended = customer.status === 'suspended';
  const [open, setOpen] = useState(false);

  const banner = suspended
    ? <><span className="font-semibold">Suspended</span> since {formatDate(customer.suspendedAt)}. Readings keep logging; they are signed out until reactivated.</>
    : customer.suspensionCandidate
      ? <><span className="font-semibold text-alert-text">Past the suspension threshold.</span> Suspending is your call; nothing happens until you do.</>
      : null;

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/billing"><ChevronLeft className="size-4" />Billing</Link>
        </Button>
        {/* Title and subtitle are one block so that on a phone, where the
            actions wrap, they wrap below both rather than between them, and
            there they take the full width as an even pair rather than
            hanging off the right edge. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
              <BillingStatusBadge status={customer.status} />
            </div>
            {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
          </div>
          <span className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <Button asChild variant="secondary" size="sm" className="flex-1 sm:flex-none">
              <Link href={`/customers/${customer.customerId}`}><UserRound className="size-4" />Customer record</Link>
            </Button>
            {!open && (suspended ? (
              <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" onClick={() => setOpen(true)}>
                <RotateCcw className="size-4" />Reactivate
              </Button>
            ) : (
              <Button variant="secondary" size="sm" className="flex-1 hover:text-alert-text sm:flex-none" onClick={() => setOpen(true)}>
                <Ban className="size-4" />Suspend
              </Button>
            ))}
          </span>
        </div>
      </div>

      {(banner || open) && (
        <Card className={`overflow-hidden ${suspended ? 'border-offline-border' : customer.suspensionCandidate ? 'border-alert-border' : ''}`}>
          {banner && <p className="px-5 py-4 text-sm">{banner}</p>}
          {open && (
            <div className={`bg-sunken px-5 py-4 ${banner ? 'border-t border-hairline' : ''}`}>
              <SuspensionPanel customerId={customer.customerId} name={customer.name} suspended={suspended} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
