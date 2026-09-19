import Link from 'next/link';
import type { BillingStatus } from '@senso/types';
import { Card, LinkRow, cn } from '@senso/ui';
import { formatDate, formatMoney } from '@/lib/format';
import { BILLING_STATUSES, BILLING_STATUS_LABEL, TERM_LABEL, TIER_LABEL, billingDetailHref } from '@/lib/billing/constants';
import { BillingStatusBadge } from '@/components/billing/BillingStatusBadge';
import type { CustomerBilling } from '@/types/billing';

// One row per customer. The filter is a set of links carrying ?status=, so the
// page stays a server component and a filtered view has a URL you can send to
// someone. Rows arrive sorted; this component only draws them.

const TH = 'px-4 py-3 font-medium sm:px-6';
const TD = 'px-4 py-3.5 sm:px-6';
const FILTER_BASE = 'rounded-chip border px-3 py-1 text-xs font-semibold transition-colors';
const FILTER_ON = 'border-transparent bg-primary text-primary-foreground';
const FILTER_OFF = 'border-border bg-card text-muted-foreground hover:bg-sunken hover:text-foreground';

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={cn(FILTER_BASE, active ? FILTER_ON : FILTER_OFF)}>
      {children}
    </Link>
  );
}

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

export function CustomerBillingTable({ rows, filter }: { rows: CustomerBilling[]; filter: BillingStatus | null }) {
  return (
    <Card className="overflow-x-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3 sm:px-6">
        <FilterLink href="/billing" active={filter === null}>All</FilterLink>
        {BILLING_STATUSES.map(status => (
          <FilterLink key={status} href={`/billing?status=${status}`} active={filter === status}>
            {BILLING_STATUS_LABEL[status]}
          </FilterLink>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-muted-foreground">
            <th className={TH}>Customer</th>
            <th className={TH}>Plan</th>
            <th className={TH}>Sensors</th>
            <th className={TH}>Term</th>
            <th className={`${TH} whitespace-nowrap`}>Term rate</th>
            <th className={TH}>Status</th>
            <th className={TH}>Renewal</th>
            <th className={`${TH} whitespace-nowrap`}>Last payment</th>
            <th className={`${TH} text-right`}>Outstanding</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">
                {filter === null ? 'No customers yet.' : `No ${BILLING_STATUS_LABEL[filter].toLowerCase()} customers.`}
              </td>
            </tr>
          )}
          {rows.map(row => {
            const href = billingDetailHref(row.customerId);
            return (
              <LinkRow key={row.customerId} href={href}>
                <td className={TD}>
                  <Link href={href} className="font-medium hover:underline">{row.name}</Link>
                  {row.email && <p className="text-xs text-muted-foreground">{row.email}</p>}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {row.tier ? (
                    <>
                      {TIER_LABEL[row.tier]}
                      {row.subscriptionCount > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground">×{row.subscriptionCount}</span>
                      )}
                    </>
                  ) : <Dash />}
                </td>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>
                  {row.subscriptionCount === 0 ? (
                    <Dash />
                  ) : row.sensorMismatch ? (
                    <span className="font-medium text-warn-text" title="The plan's sensor count is not what is installed">
                      {row.sensorCount} on plan · {row.installedSensors} installed
                    </span>
                  ) : row.sensorCount}
                </td>
                <td className={`${TD} whitespace-nowrap`}>{row.termMonths ? TERM_LABEL[row.termMonths] : <Dash />}</td>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>
                  {row.termTotal !== null ? formatMoney(row.termTotal) : <Dash />}
                </td>
                <td className={TD}><BillingStatusBadge status={row.status} /></td>
                <td className={`${TD} whitespace-nowrap`}>
                  {row.nextRenewal ? (
                    <span className={row.renewalNeedsInvoice ? 'font-medium text-warn-text' : ''}>
                      {formatDate(row.nextRenewal)}
                    </span>
                  ) : <Dash />}
                </td>
                <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                  {row.lastPaymentOn ? formatDate(row.lastPaymentOn) : <Dash />}
                </td>
                <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>
                  {row.outstanding > 0 ? (
                    <span className={row.overdueAmount > 0 ? 'font-medium text-alert-text' : ''}>
                      {formatMoney(row.outstanding)}
                    </span>
                  ) : <Dash />}
                </td>
              </LinkRow>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
