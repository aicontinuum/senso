import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { BillingStatus } from '@senso/types';
import { Card, LinkRow, cn } from '@senso/ui';
import { formatDate, formatMoney } from '@/lib/format';
import { BILLING_STATUSES, BILLING_STATUS_LABEL, TERM_LABEL, TIER_LABEL, billingDetailHref } from '@/lib/billing/constants';
import { BillingStatusDot } from '@/components/billing/BillingStatusDot';
import type { CustomerBilling } from '@/types/billing';

// One row per customer, in two forms of the same data: a six-column table
// from desktop width up, and a stacked list below it, where a table would
// only scroll sideways. Status is a dot before the name rather than a
// column; the filter chips and the summary bar carry the words. The row is
// the business name alone: the email lives on the customer's own page. The filter
// is a set of links carrying ?status=, so the page stays a server component
// and a filtered view has a URL you can send to someone. Rows arrive
// sorted; this component only draws them.

const TH = 'px-4 py-3 font-medium sm:px-6';
const TD = 'px-4 py-3.5 sm:px-6';
// The same press feel as a Button: a fast ease-out scale on :active, and no
// scale at all when motion is reduced.
const FILTER_BASE = 'rounded-chip border px-3 py-1 text-xs font-semibold transition-[background-color,border-color,color,transform] duration-[--dur-fast] ease-[--ease-out] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100';
const FILTER_ON = 'border-transparent bg-primary text-primary-foreground';
const FILTER_OFF = 'border-border bg-card text-muted-foreground hover:bg-sunken hover:text-foreground';
const LIST_ROW = 'flex items-center gap-3 px-4 py-3.5 transition-colors duration-[--dur-fast] hover:bg-sunken active:bg-inset';

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

// The cells, written once so the table and the list never disagree.

function PlanCell({ row }: { row: CustomerBilling }) {
  if (!row.tier || !row.termMonths) return <Dash />;
  return (
    <>
      {TIER_LABEL[row.tier]}
      <span className="text-muted-foreground"> · {TERM_LABEL[row.termMonths]}</span>
      {row.subscriptionCount > 1 && <span className="ml-1 text-xs text-muted-foreground">×{row.subscriptionCount}</span>}
    </>
  );
}

function SensorsCell({ row }: { row: CustomerBilling }) {
  if (row.subscriptionCount === 0) return <Dash />;
  if (row.sensorMismatch) {
    return (
      <span className="font-medium text-warn-text" title="The plan's sensor count is not what is installed">
        {row.sensorCount} on plan · {row.installedSensors} installed
      </span>
    );
  }
  return <>{row.sensorCount}</>;
}

function RenewalCell({ row, renewalNoticeDays }: { row: CustomerBilling; renewalNoticeDays: number }) {
  if (!row.nextRenewal) return <Dash />;
  const soon = row.daysToRenewal !== null && row.daysToRenewal >= 0 && row.daysToRenewal <= renewalNoticeDays;
  return <span className={soon ? 'font-medium text-warn-text' : ''}>{formatDate(row.nextRenewal)}</span>;
}

function OutstandingCell({ row }: { row: CustomerBilling }) {
  if (row.outstanding <= 0) return <Dash />;
  return <span className={row.overdueAmount > 0 ? 'font-medium text-alert-text' : ''}>{formatMoney(row.outstanding)}</span>;
}

function NameCell({ row, href }: { row: CustomerBilling; href: string }) {
  return (
    <div className="flex items-center gap-2">
      <BillingStatusDot status={row.status} />
      <Link href={href} className={cn('font-medium hover:underline', row.status === 'suspended' && 'text-muted-foreground')}>{row.name}</Link>
    </div>
  );
}

type Props = { rows: CustomerBilling[]; filter: BillingStatus | null; renewalNoticeDays: number };

export function CustomerBillingTable({ rows, filter, renewalNoticeDays }: Props) {
  const empty = filter === null ? 'No customers yet.' : `No ${BILLING_STATUS_LABEL[filter].toLowerCase()} customers.`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterLink href="/billing" active={filter === null}>All</FilterLink>
        {BILLING_STATUSES.map(status => (
          <FilterLink key={status} href={`/billing?status=${status}`} active={filter === status}>
            {BILLING_STATUS_LABEL[status]}
          </FilterLink>
        ))}
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <>
            {/* Desktop: the table. */}
            <table className="hidden w-full text-sm lg:table">
              <thead>
                <tr className="border-b border-hairline text-left text-muted-foreground">
                  <th className={TH}>Customer</th>
                  <th className={TH}>Plan</th>
                  <th className={TH}>Sensors</th>
                  <th className={`${TH} whitespace-nowrap`}>Term rate</th>
                  <th className={TH}>Renewal</th>
                  <th className={`${TH} text-right`}>Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map(row => {
                  const href = billingDetailHref(row.customerId);
                  return (
                    <LinkRow key={row.customerId} href={href}>
                      <td className={TD}><NameCell row={row} href={href} /></td>
                      <td className={`${TD} whitespace-nowrap`}><PlanCell row={row} /></td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}><SensorsCell row={row} /></td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>{row.termTotal !== null ? formatMoney(row.termTotal) : <Dash />}</td>
                      <td className={`${TD} whitespace-nowrap`}><RenewalCell row={row} renewalNoticeDays={renewalNoticeDays} /></td>
                      <td className={`${TD} whitespace-nowrap text-right tabular-nums`}><OutstandingCell row={row} /></td>
                    </LinkRow>
                  );
                })}
              </tbody>
            </table>

            {/* Phone: the same rows as a list. The name alone on the left; on
                the right the plan and the term rate, and the balance owed
                when there is one. The renewal date and the sensor mismatch
                stay on the desktop table and the customer's page. */}
            <ul className="divide-y divide-hairline lg:hidden">
              {rows.map(row => {
                const href = billingDetailHref(row.customerId);
                return (
                  <li key={row.customerId}>
                    <Link href={href} className={LIST_ROW}>
                      <BillingStatusDot status={row.status} />
                      <p className={cn('min-w-0 flex-1 truncate text-sm font-medium', row.status === 'suspended' && 'text-muted-foreground')}>{row.name}</p>
                      <div className="shrink-0 text-right text-xs">
                        {row.subscriptionCount === 0 ? (
                          <p className="text-muted-foreground">No plan yet</p>
                        ) : (
                          <>
                            <p><PlanCell row={row} /></p>
                            <p className="mt-0.5 tabular-nums">{row.termTotal !== null ? `${formatMoney(row.termTotal)} / term` : <Dash />}</p>
                          </>
                        )}
                        {row.outstanding > 0 && <p className="mt-0.5 tabular-nums"><OutstandingCell row={row} /> owed</p>}
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
