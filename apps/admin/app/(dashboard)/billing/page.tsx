import type { BillingStatus } from '@senso/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadBillingOverview } from '@/lib/billing/overview';
import { BILLING_STATUSES } from '@/lib/billing/constants';
import { BillingSummaryStrip } from '@/components/billing/BillingSummaryStrip';
import { NeedsActionCard } from '@/components/billing/NeedsActionCard';
import { CustomerBillingTable } from '@/components/billing/CustomerBillingTable';
import type { CustomerBilling } from '@/types/billing';

// The money page. Three levels: the strip says how the business is doing, the
// work list says what to do today, the table is every customer. All of it is
// read from the database; nothing here is a stored flag that could go stale.

// Highest first: a suspended account, then one owing overdue money, then one
// with a renewal inside the notice window, then the alphabet.
function attentionRank(row: CustomerBilling, renewalNoticeDays: number): number {
  if (row.status === 'suspended') return 3;
  if (row.overdueAmount > 0) return 2;
  if (row.daysToRenewal !== null && row.daysToRenewal >= 0 && row.daysToRenewal <= renewalNoticeDays) return 1;
  return 0;
}

function parseStatusFilter(value: string | string[] | undefined): BillingStatus | null {
  const one = Array.isArray(value) ? value[0] : value;
  return (BILLING_STATUSES as readonly string[]).includes(one ?? '') ? (one as BillingStatus) : null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const filter = parseStatusFilter((await searchParams).status);
  const { customers, summary, needsAction, renewalNoticeDays } = await loadBillingOverview(createAdminClient());

  const rows = customers
    .filter(c => filter === null || c.status === filter)
    .sort((a, b) =>
      attentionRank(b, renewalNoticeDays) - attentionRank(a, renewalNoticeDays)
      || b.daysOverdue - a.daysOverdue
      || a.name.localeCompare(b.name),
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Billing</h1>

      <BillingSummaryStrip summary={summary} renewalNoticeDays={renewalNoticeDays} />

      <NeedsActionCard needsAction={needsAction} />

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Customers</h2>
        <CustomerBillingTable rows={rows} filter={filter} renewalNoticeDays={renewalNoticeDays} />
      </div>
    </div>
  );
}
