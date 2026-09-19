import type { BillingStatus } from '@senso/types';
import { Badge } from '@senso/ui';
import { BILLING_STATUS_LABEL, BILLING_STATUS_TONE } from '@/lib/billing/constants';

// The one way a billing status is drawn, so the table, the detail page and the
// Needs Action lists never colour the same word differently.
export function BillingStatusBadge({ status }: { status: BillingStatus }) {
  return (
    <Badge variant={BILLING_STATUS_TONE[status]} dot>
      {BILLING_STATUS_LABEL[status]}
    </Badge>
  );
}
