import { Card, StatusDot } from '@senso/ui';
import { CURRENCY, formatAmount, formatMoney } from '@/lib/format';
import { BILLING_STATUSES, BILLING_STATUS_LABEL, BILLING_STATUS_TONE } from '@/lib/billing/constants';
import type { BillingSummary } from '@/types/billing';

// One instrument, three zones. The hero is annualised expected revenue,
// the number that says how big the business is; the three tiles beside it
// sit on a sunken field, separated by space rather than lines. Under both,
// the customers as the form the data is: a part-to-whole bar in the status
// palette with a legend, so an overdue share is seen before it is read.
// Money is tinted only when it is a problem: overdue in red when non-zero,
// and a zero never in red, which would pull the eye toward nothing.

const TILE = 'rounded-inner bg-sunken px-4 py-3';
const TILE_LABEL = 'text-xs font-medium text-muted-foreground';
const TILE_VALUE = 'mt-0.5 font-display text-xl font-bold';
const TILE_NOTE = 'mt-1 text-xs text-muted-foreground';

// A display figure sets the amount first and the currency code after it in
// smaller, quieter type: the number is what the eye is scanning for, and
// "5,400 QAR" never breaks into two lines the way "QAR 5,400" did.
function Money({ amount, className }: { amount: number; className?: string }) {
  return (
    <span className={className}>
      {formatAmount(amount)}
      <span className="ml-1 text-[0.5em] font-semibold text-muted-foreground">{CURRENCY}</span>
    </span>
  );
}

// The bar's segments carry the status fills; the legend beside them carries
// the words, so identity never rests on colour alone.
const SEGMENT_FILL: Record<string, string> = { ok: 'bg-ok-500', alert: 'bg-alert-500', offline: 'bg-offline-500' };
const BAR_HEIGHT = 'h-2';

function overdueNote(summary: BillingSummary): string {
  if (summary.overdueCustomers === 0) return 'no customers overdue';
  return `${summary.overdueCustomers} ${summary.overdueCustomers === 1 ? 'customer' : 'customers'} overdue`;
}

function CustomerBar({ summary }: { summary: BillingSummary }) {
  const total = BILLING_STATUSES.reduce((n, status) => n + summary.byStatus[status], 0);
  const label = BILLING_STATUSES.map(status => `${BILLING_STATUS_LABEL[status]} ${summary.byStatus[status]}`).join(', ');
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm font-medium text-muted-foreground">{total} {total === 1 ? 'customer' : 'customers'}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {BILLING_STATUSES.map(status => (
            <li key={status} className="flex items-center gap-1.5">
              <StatusDot status={BILLING_STATUS_TONE[status]} />
              <span className="text-muted-foreground">{BILLING_STATUS_LABEL[status]}</span>
              <span className="font-medium tabular-nums">{summary.byStatus[status]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`mt-2 flex ${BAR_HEIGHT} gap-0.5 overflow-hidden rounded-full bg-sunken`} role="img" aria-label={label}>
        {BILLING_STATUSES.filter(status => summary.byStatus[status] > 0).map(status => (
          <div
            key={status}
            className={`h-full rounded-full ${SEGMENT_FILL[BILLING_STATUS_TONE[status]]}`}
            style={{ flexGrow: summary.byStatus[status] }}
          />
        ))}
      </div>
    </div>
  );
}

export function BillingSummaryStrip({ summary, renewalNoticeDays }: { summary: BillingSummary; renewalNoticeDays: number }) {
  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
        {/* The hero steps down a size on a phone so the figure stays on one
            line and the tiles come into view sooner. */}
        <div>
          <p className="text-sm font-medium text-muted-foreground">Annualised Exp. Rev</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl"><Money amount={summary.annualised} /></p>
          <p className="mt-2 text-sm text-muted-foreground">from active terms</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className={TILE}>
            <p className={TILE_LABEL}>Total paid</p>
            <p className={TILE_VALUE}><Money amount={summary.totalPaid} /></p>
            <p className={TILE_NOTE}>all customers, all time</p>
          </div>
          <div className={TILE}>
            <p className={TILE_LABEL}>Overdue</p>
            <p className={`${TILE_VALUE} ${summary.overdueAmount > 0 ? 'text-alert-text' : ''}`}><Money amount={summary.overdueAmount} /></p>
            <p className={TILE_NOTE}>{overdueNote(summary)}</p>
          </div>
          <div className={`${TILE} sm:col-span-2 lg:col-span-1`}>
            <p className={TILE_LABEL}>Renewals, next {renewalNoticeDays} days</p>
            <p className={TILE_VALUE}>{summary.renewalsDueCount}</p>
            <p className={TILE_NOTE}>worth {formatMoney(summary.renewalsDueValue)}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <CustomerBar summary={summary} />
      </div>
    </Card>
  );
}
