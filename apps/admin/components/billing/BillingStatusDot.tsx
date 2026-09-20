import type { BillingStatus } from '@senso/types';
import { StatusDot } from '@senso/ui';
import { BILLING_STATUS_LABEL, BILLING_STATUS_TONE } from '@/lib/billing/constants';

// A customer's billing status as a dot before their name: green, red or
// grey, the same tones the summary bar and the filter chips carry the words
// for. The name is in the tooltip and read to a screen reader, so colour is
// never the only signal on the row.
export function BillingStatusDot({ status }: { status: BillingStatus }) {
  const label = BILLING_STATUS_LABEL[status];
  return (
    <span className="inline-flex shrink-0 items-center" title={label}>
      <StatusDot status={BILLING_STATUS_TONE[status]} className="size-2" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
