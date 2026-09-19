import { Card, CardHeader, CardTitle } from '@senso/ui';
import { describeBillingEvent } from '@/lib/billing/describe-event';
import type { BillingEvent } from '@/types/billing';

// The change log, read-only. One line per event: what happened, from what to
// what, and the reason if one was given.

const timeFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function BillingEventsSection({ events }: { events: BillingEvent[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-hairline"><CardTitle>Change log</CardTitle></CardHeader>
      {events.length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">Nothing has changed yet.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {events.map(e => (
            <li key={e.id} className="px-5 py-3 text-sm">
              <p className="text-xs text-muted-foreground">{timeFormatter.format(new Date(e.createdAt))}</p>
              <p className="mt-0.5">{describeBillingEvent(e)}</p>
              {e.reason && <p className="mt-0.5 text-xs text-muted-foreground">Reason: {e.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
