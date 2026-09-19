import { Card, StatusDot } from '@senso/ui';
import { formatMoney } from '@/lib/format';
import { BILLING_STATUSES, BILLING_STATUS_LABEL, BILLING_STATUS_TONE } from '@/lib/billing/constants';
import type { BillingSummary } from '@/types/billing';

// Five tiles in one card, the same instrument the dashboard uses. Money is
// tinted only when it is a problem: outstanding is normal business, overdue
// is not, and a zero in alert red would pull the eye toward nothing.

const STAT_TILE = 'px-4 py-4 sm:px-6 sm:py-5';
const STAT_VALUE = 'mt-1 font-display text-2xl font-bold tabular-nums';

export function BillingSummaryStrip({ summary, renewalNoticeDays }: { summary: BillingSummary; renewalNoticeDays: number }) {
  return (
    <Card className="grid grid-cols-2 overflow-hidden lg:grid-cols-5 [&>*]:border-hairline [&>*:nth-child(even)]:border-l [&>*:nth-child(-n+4)]:border-b lg:[&>*:not(:first-child)]:border-l lg:[&>*]:border-b-0">
      <div className={STAT_TILE}>
        <p className="text-sm font-medium text-muted-foreground">Annualised revenue</p>
        <p className={STAT_VALUE}>{formatMoney(summary.annualised)}</p>
        <p className="mt-2 text-sm text-muted-foreground">from active terms</p>
      </div>
      <div className={STAT_TILE}>
        <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
        <p className={STAT_VALUE}>{formatMoney(summary.outstanding)}</p>
        <p className="mt-2 text-sm text-muted-foreground">invoiced, not yet paid</p>
      </div>
      <div className={STAT_TILE}>
        <p className="text-sm font-medium text-muted-foreground">Overdue</p>
        <p className={`${STAT_VALUE} ${summary.overdueAmount > 0 ? 'text-alert-text' : ''}`}>
          {formatMoney(summary.overdueAmount)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {summary.overdueCustomers === 0
            ? 'no customers overdue'
            : `${summary.overdueCustomers} ${summary.overdueCustomers === 1 ? 'customer' : 'customers'} overdue`}
        </p>
      </div>
      <div className={STAT_TILE}>
        <p className="text-sm font-medium text-muted-foreground">Renewals, next {renewalNoticeDays} days</p>
        <p className={STAT_VALUE}>{summary.renewalsDueCount}</p>
        <p className="mt-2 text-sm text-muted-foreground">worth {formatMoney(summary.renewalsDueValue)}</p>
      </div>
      <div className={`${STAT_TILE} col-span-2 lg:col-span-1`}>
        <p className="text-sm font-medium text-muted-foreground">Customers</p>
        <dl className="mt-2 space-y-1 text-sm">
          {BILLING_STATUSES.map(status => (
            <div key={status} className="flex items-center gap-2">
              <StatusDot status={BILLING_STATUS_TONE[status]} />
              <dt className="text-muted-foreground">{BILLING_STATUS_LABEL[status]}</dt>
              <dd className="ml-auto font-medium tabular-nums">{summary.byStatus[status]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}
