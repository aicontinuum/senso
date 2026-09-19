'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, LinkRow } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { invoiceHref } from '@/lib/billing/constants';
import { InvoiceStateBadge } from '@/components/billing/InvoiceStateBadge';
import type { Invoice } from '@/types/billing';

// The customer's invoices, one row each, and nothing else: every row is a
// link to the invoice's own page, where the editing, sending, paying and
// history live. "New invoice" opens an empty draft and goes straight there.

type Props = { customerId: string; invoices: Invoice[] };

const TH = 'px-4 py-3 font-medium sm:px-5';
const TD = 'px-4 py-3.5 sm:px-5';

export function InvoicesSection({ customerId, invoices }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    setError('');
    setCreating(true);
    const result = await callApi<{ invoiceId: string }>(`/api/billing/customers/${customerId}/invoices`, 'POST', {});
    if (!result.ok) { setCreating(false); setError(result.error); return; }
    router.push(invoiceHref(customerId, result.data.invoiceId));
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <div className="flex items-baseline gap-2">
          <CardTitle>Invoices</CardTitle>
          <span className="font-display text-md font-semibold tabular-nums text-muted-foreground">{invoices.length}</span>
        </div>
        <Button size="sm" onClick={create} disabled={creating}>
          <Plus className="size-4" />
          {creating ? 'Opening…' : 'New invoice'}
        </Button>
      </CardHeader>

      {error && <p role="alert" className="px-5 pt-4 text-sm text-alert-text">{error}</p>}

      {invoices.length === 0 ? (
        <div className="m-5 rounded-inner border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">New invoice opens a draft; one click fills it from the plan.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-muted-foreground">
                <th className={TH}>Number</th>
                <th className={TH}>Issued</th>
                <th className={TH}>Due</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={`${TH} text-right`}>Paid</th>
                <th className={TH}>State</th>
                <th className={`${TH} relative`}><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {invoices.map(inv => {
                const href = invoiceHref(customerId, inv.id);
                return (
                  <LinkRow key={inv.id} href={href}>
                    <td className={`${TD} whitespace-nowrap font-medium`}>
                      <Link href={href} className="hover:underline">{inv.number ?? 'Draft'}</Link>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{formatDate(inv.issuedOn)}</td>
                    <td className={`${TD} whitespace-nowrap ${inv.overdue ? 'font-medium text-alert-text' : 'text-muted-foreground'}`}>{formatDate(inv.dueOn)}</td>
                    <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{formatMoney(inv.total)}</td>
                    <td className={`${TD} whitespace-nowrap text-right tabular-nums text-muted-foreground`}>{inv.paid > 0 ? formatMoney(inv.paid) : '—'}</td>
                    <td className={TD}><InvoiceStateBadge invoice={inv} /></td>
                    <td className={`${TD} text-right`}><ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden /></td>
                  </LinkRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
