import { Card, CardHeader, CardTitle } from '@senso/ui';
import { EVENT_KIND } from '@/lib/billing/events';
import { describeInvoiceEvent } from '@/lib/billing/describe-event';
import type { BillingEvent, Invoice } from '@/types/billing';

// Everything that has happened to this invoice, oldest first, so it reads
// as a story: created, issued, emailed, paid, voided. Creation is not an
// event in the log (a draft is scratch paper), so it is drawn from the
// invoice itself.

const timeFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type Entry = { key: string; at: string; text: string; note: string | null };

function entriesOf(invoice: Invoice, events: BillingEvent[]): Entry[] {
  const created: Entry = { key: 'created', at: invoice.createdAt, text: 'Draft created', note: null };
  const rest = events.map((e): Entry => ({
    key: e.id,
    at: e.createdAt,
    text: describeInvoiceEvent(e),
    note: e.reason ? `${e.kind === EVENT_KIND.payment ? 'Ref' : 'Reason'}: ${e.reason}` : null,
  }));
  return [created, ...rest];
}

export function InvoiceHistoryCard({ invoice, events }: { invoice: Invoice; events: BillingEvent[] }) {
  const entries = entriesOf(invoice, events);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-hairline"><CardTitle>History</CardTitle></CardHeader>
      <ul className="divide-y divide-hairline">
        {entries.map(e => (
          <li key={e.key} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-5 py-3 text-sm">
            <span className="w-36 shrink-0 text-xs text-muted-foreground">{timeFormatter.format(new Date(e.at))}</span>
            <span>{e.text}</span>
            {e.note && <span className="text-xs text-muted-foreground">{e.note}</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
