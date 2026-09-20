import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, StatusDot, type StatusTone } from '@senso/ui';
import { formatDaysRelative, formatMoney } from '@/lib/format';
import { billingDetailHref } from '@/lib/billing/constants';
import type { NeedsAction } from '@/types/billing';

// The work list. Each section is one kind of thing to do, most urgent first,
// and every row is a link to the customer where it gets done. A section with
// nothing in it is not drawn: an empty "Overdue" heading is noise, and the
// card saying "Nothing needs action" is the reading that matters.

type ActionItem = {
  key: string;
  href: string;
  title: string;
  detail: string;
  amount: number | null;
  when: string;
};

function ActionSection({ heading, tone, items }: { heading: string; tone: StatusTone; items: ActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-6">
        <StatusDot status={tone} />
        {heading}
        <span className="font-normal tabular-nums">({items.length})</span>
      </h3>
      <ul className="divide-y divide-hairline border-t border-hairline">
        {items.map(item => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors duration-[--dur-fast] hover:bg-sunken active:bg-inset sm:px-6"
            >
              <span className="font-medium">{item.title}</span>
              <span className="text-muted-foreground">{item.detail}</span>
              <span className="ml-auto flex items-center gap-4 whitespace-nowrap">
                {item.amount !== null && <span className="tabular-nums">{formatMoney(item.amount)}</span>}
                <span className="text-muted-foreground">{item.when}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NeedsActionCard({ needsAction }: { needsAction: NeedsAction }) {
  const { unpaid, overdue, suspensionCandidates, sensorMismatches } = needsAction;
  const total = unpaid.length + overdue.length + suspensionCandidates.length + sensorMismatches.length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-3 sm:px-6">
        <h2 className="text-sm font-semibold tracking-tight">Needs action</h2>
        <span className="text-sm text-muted-foreground">
          {total === 0 ? 'Nothing needs action' : `${total} ${total === 1 ? 'item' : 'items'}`}
        </span>
      </div>

      {total > 0 && (
        <div className="divide-y divide-hairline border-t border-hairline">
          <ActionSection
            heading="Past suspension threshold"
            tone="alert"
            items={suspensionCandidates.map(c => ({
              key: c.customerId,
              href: billingDetailHref(c.customerId),
              title: c.name,
              detail: 'suspension is your call',
              amount: c.overdueAmount,
              when: `${c.daysOverdue} days overdue`,
            }))}
          />
          <ActionSection
            heading="Invoices overdue"
            tone="alert"
            items={overdue.map(i => ({
              key: i.id,
              href: billingDetailHref(i.customerId),
              title: i.customerName,
              detail: i.number,
              amount: i.total,
              when: `due ${formatDaysRelative(-i.daysOverdue)}`,
            }))}
          />
          <ActionSection
            heading="Plan does not match installed sensors"
            tone="warn"
            items={sensorMismatches.map(c => ({
              key: `sensors-${c.customerId}`,
              href: billingDetailHref(c.customerId),
              title: c.name,
              detail: `${c.sensorCount} on plan, ${c.installedSensors} installed`,
              amount: null,
              when: c.installedSensors > c.sensorCount ? 'charging for fewer than installed' : 'charging for more than installed',
            }))}
          />
          <ActionSection
            heading="Invoices sent, not yet due"
            tone="ok"
            items={unpaid.map(i => ({
              key: i.id,
              href: billingDetailHref(i.customerId),
              title: i.customerName,
              detail: i.number,
              amount: i.total,
              when: `due ${formatDaysRelative(-i.daysOverdue)}`,
            }))}
          />
        </div>
      )}
    </Card>
  );
}
