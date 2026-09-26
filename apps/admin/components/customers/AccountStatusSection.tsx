'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Ban, CreditCard, RotateCcw } from 'lucide-react';
import { Button, Card, CardDescription, CardHeader, CardTitle } from '@senso/ui';
import { formatDate } from '@/lib/format';
import { BILLING_STATUSES } from '@/lib/billing/constants';
import { BillingStatusBadge } from '@/components/billing/BillingStatusBadge';
import { SuspensionPanel } from '@/components/billing/SuspensionPanel';
import type { BillingStatus } from '@senso/types';

// Whether the customer can use the app, and the switch for it, on the
// customer page as well as the billing page: suspending is a support
// decision as often as a money one. The reason goes into the same change
// log either way.

type Props = { customerId: string; name: string; status: string | null; suspendedAt: string | null };

function asBillingStatus(status: string | null): BillingStatus {
  return (BILLING_STATUSES as readonly string[]).includes(status ?? '') ? (status as BillingStatus) : 'active';
}

export function AccountStatusSection({ customerId, name, status, suspendedAt }: Props) {
  const [open, setOpen] = useState(false);
  const billingStatus = asBillingStatus(status);
  const suspended = billingStatus === 'suspended';

  return (
    <Card className={`overflow-hidden ${suspended ? 'border-offline-border' : ''}`}>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>Account status</CardTitle>
            <BillingStatusBadge status={billingStatus} />
          </div>
          <CardDescription>
            {suspended
              ? <>Suspended since {formatDate(suspendedAt)}. They are signed out and cannot sign in; readings and alerts continue.</>
              : 'They can sign in and use the app. Suspending signs them out until reactivated.'}
          </CardDescription>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/billing/${customerId}`}><CreditCard className="size-4" />Billing</Link>
          </Button>
          {!open && (suspended ? (
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              <RotateCcw className="size-4" />Reactivate
            </Button>
          ) : (
            <Button variant="secondary" size="sm" className="hover:text-alert-text" onClick={() => setOpen(true)}>
              <Ban className="size-4" />Suspend
            </Button>
          ))}
        </span>
      </CardHeader>
      {open && (
        <div className="bg-sunken px-5 py-4">
          <SuspensionPanel customerId={customerId} name={name} suspended={suspended} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </div>
      )}
    </Card>
  );
}
