import { Badge } from '@senso/ui';
import { INVOICE_STATE_LABEL } from '@/lib/billing/constants';
import type { Invoice } from '@/types/billing';

// Draft, Sent, Paid, Void — and Overdue, which is a Sent invoice past its due
// date, derived when drawn so a late payment never leaves a stale flag.
export function InvoiceStateBadge({ invoice }: { invoice: Pick<Invoice, 'state' | 'overdue'> }) {
  if (invoice.overdue) return <Badge variant="alert" dot>Overdue</Badge>;
  switch (invoice.state) {
    case 'draft': return <Badge variant="outline">{INVOICE_STATE_LABEL.draft}</Badge>;
    case 'sent': return <Badge variant="warn" dot>{INVOICE_STATE_LABEL.sent}</Badge>;
    case 'paid': return <Badge variant="ok" dot>{INVOICE_STATE_LABEL.paid}</Badge>;
    case 'void': return <Badge variant="offline">{INVOICE_STATE_LABEL.void}</Badge>;
  }
}
