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
// history live. A table from desktop width up, a stacked list below it.
// "New invoice" opens an empty draft and goes straight there.

type Props = { customerId: string; invoices: Invoice[] };

const TH = 'px-4 py-3 font-medium sm:px-5';
const TD = 'px-4 py-3.5 sm:px-5';
const LIST_ROW = 'flex items-center gap-3 px-4 py-3.5 transition-colors duration-[--dur-fast] hover:bg-sunken active:bg-inset';

function DueCell({ invoice }: { invoice: Invoice }) {
  return <span className={invoice.overdue ? 'font-medium text-alert-text' : 'text-muted-foreground'}>{formatDate(invoice.dueOn)}</span>;
}

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
          <p className="mt-1 text-xs text-muted-foreground">New invoice opens a draft; add lines and issue it from there.</p>
        </div>
      ) : (
        <>
          {/* Desktop: the table. */}
          <table className="hidden w-full text-sm lg:table">
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
                    <td className={`${TD} whitespace-nowrap`}><DueCell invoice={inv} /></td>
                    <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{formatMoney(inv.total)}</td>
                    <td className={`${TD} whitespace-nowrap text-right tabular-nums text-muted-foreground`}>{inv.paid > 0 ? formatMoney(inv.paid) : '—'}</td>
                    <td className={TD}><InvoiceStateBadge invoice={inv} /></td>
                    <td className={`${TD} text-right`}><ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden /></td>
                  </LinkRow>
                );
              })}
            </tbody>
          </table>

          {/* Phone: number and state, the dates under, the money on the right. */}
          <ul className="divide-y divide-hairline lg:hidden">
            {invoices.map(inv => (
              <li key={inv.id}>
                <Link href={invoiceHref(customerId, inv.id)} className={LIST_ROW}>
                  <div className="min-w-0 flex-1 text-sm">
                    {/* A draft has no number, so its state is its name and the
                        badge would only say it twice. */}
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{inv.number ?? 'Draft invoice'}</span>
                      {inv.number && <InvoiceStateBadge invoice={inv} />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {inv.issuedOn ? `Issued ${formatDate(inv.issuedOn)}` : 'Not issued'}
                      {inv.dueOn && <> · Due <DueCell invoice={inv} /></>}
                    </p>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p>{formatMoney(inv.total)}</p>
                    {inv.paid > 0 && <p className="text-xs text-muted-foreground">Paid {formatMoney(inv.paid)}</p>}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
