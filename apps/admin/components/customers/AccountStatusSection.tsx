'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, CreditCard, FlaskConical, RotateCcw } from 'lucide-react';
import { callApi } from '@/lib/api-client';
import { Button, Card, CardDescription, CardHeader, CardTitle } from '@senso/ui';
import { formatDate } from '@/lib/format';
import { BILLING_STATUSES } from '@/lib/billing/constants';
import { BillingStatusBadge } from '@/components/billing/BillingStatusBadge';
import { SuspensionPanel } from '@/components/billing/SuspensionPanel';
import type { BillingStatus } from '@senso/types';

// Whether the customer can use the app, and the switch for it, on the
// customer page as well as the billing page: suspending is a support
// decision as often as a money one. The reason goes into the same change
// log either way. Below it, the test switch: a rehearsal account keeps
// every feature and counts in no billing total.

type Props = { customerId: string; name: string; status: string | null; suspendedAt: string | null; isTest: boolean };

function asBillingStatus(status: string | null): BillingStatus {
  return (BILLING_STATUSES as readonly string[]).includes(status ?? '') ? (status as BillingStatus) : 'active';
}

export function AccountStatusSection({ customerId, name, status, suspendedAt, isTest }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testError, setTestError] = useState('');

  async function setTest(next: boolean) {
    setTestError('');
    setTestBusy(true);
    const result = await callApi(`/api/customers/${customerId}/test`, 'POST', { isTest: next });
    setTestBusy(false);
    if (!result.ok) { setTestError(result.error); return; }
    router.refresh();
  }
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3">
        <p className="text-sm text-muted-foreground">
          {isTest
            ? 'Test account: its invoices and payments count in no billing total. Everything else works as normal.'
            : 'A real customer. Mark it as a test account to keep its invoices and payments out of every billing total.'}
        </p>
        <span className="flex shrink-0 items-center gap-2">
          {testError && <span className="text-xs text-alert-text">{testError}</span>}
          <Button variant="ghost" size="sm" onClick={() => setTest(!isTest)} disabled={testBusy}>
            <FlaskConical className="size-4" />
            {testBusy ? 'Saving…' : isTest ? 'Mark as real customer' : 'Mark as test account'}
          </Button>
        </span>
      </div>
    </Card>
  );
}
