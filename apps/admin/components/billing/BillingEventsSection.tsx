import { Card, CardHeader, CardTitle } from '@senso/ui';
import { EVENT_KIND } from '@/lib/billing/events';
import { PAYMENT_METHOD_LABEL } from '@/lib/billing/constants';
import type { BillingEvent, PaymentMethod } from '@/types/billing';

// The change log, read-only. One line per event: what happened, from what to
// what, and the reason if one was given.

const timeFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const FIELD_LABEL: Record<string, string> = {
  monthly_rate: 'monthly rate', addon_monthly_rate: 'add-on rate', term_total: 'term total', renewal_date: 'renewal date',
  term_start: 'term start', term_months: 'term', sensor_count: 'sensors', addon_count: 'add-ons', tier: 'tier', label: 'label', status: 'status',
};

function describe(e: BillingEvent): string {
  const ref = e.invoiceNumber ?? e.subscriptionLabel;
  const at = ref ? ` (${ref})` : '';
  switch (e.kind) {
    case EVENT_KIND.subscriptionCreated: return `Plan created${at}: ${e.newValue ?? ''}`;
    case EVENT_KIND.subscriptionEnded: return `Plan ended${at}${e.newValue ? ` on ${e.newValue}` : ''}`;
    case EVENT_KIND.override: return `${FIELD_LABEL[e.field ?? ''] ?? e.field ?? 'value'} changed${at}: ${e.oldValue ?? 'proposed'} → ${e.newValue ?? '—'}`;
    case EVENT_KIND.invoiceIssued: return `Invoice ${e.newValue ?? ''} issued`;
    case EVENT_KIND.invoiceVoided: return `Invoice ${e.oldValue ?? ''} voided`;
    case EVENT_KIND.invoiceDeleted: return `Discarded a ${e.oldValue ?? 'draft'}`;
    case EVENT_KIND.invoiceSent: return `Invoice ${e.invoiceNumber ?? ''} emailed${e.newValue ? ` to ${e.newValue}` : ''}`;
    case EVENT_KIND.payment: return `Payment of ${e.newValue ?? ''} by ${PAYMENT_METHOD_LABEL[e.field as PaymentMethod] ?? e.field ?? ''}${at}`;
    case EVENT_KIND.statusChange: return `Status ${e.oldValue ?? ''} → ${e.newValue ?? ''}`;
    default: return `${e.kind}${at}`;
  }
}

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
              <p className="mt-0.5">{describe(e)}</p>
              {e.reason && <p className="mt-0.5 text-xs text-muted-foreground">Reason: {e.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
