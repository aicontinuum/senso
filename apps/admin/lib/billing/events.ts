// The change log. Every override, status change, issue, void and payment
// writes one row here alongside the change it describes, so the detail page
// can show who changed what, from what, to what, and why.

import type { createAdminClient } from '@/lib/supabase/admin';

export const EVENT_KIND = {
  subscriptionCreated: 'subscription_created',
  subscriptionEnded: 'subscription_ended',
  override: 'override',
  invoiceCreated: 'invoice_created',
  invoiceIssued: 'invoice_issued',
  invoiceVoided: 'invoice_voided',
  invoiceDeleted: 'invoice_deleted',
  invoiceSent: 'invoice_sent',
  invoiceArchived: 'invoice_archived',
  invoiceUnarchived: 'invoice_unarchived',
  payment: 'payment',
  statusChange: 'status_change',
} as const;

export type EventKind = (typeof EVENT_KIND)[keyof typeof EVENT_KIND];

export type BillingEventInput = {
  customerId: string;
  kind: EventKind;
  actorId: string;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  field?: string | null;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  reason?: string | null;
};

/** Writes one event. A failure here is logged, never thrown: the change it
 *  describes has already happened and must not be reported as failed. */
export async function recordBillingEvent(
  admin: ReturnType<typeof createAdminClient>,
  input: BillingEventInput,
): Promise<void> {
  const { error } = await admin.from('billing_events').insert({
    customer_id: input.customerId,
    subscription_id: input.subscriptionId ?? null,
    invoice_id: input.invoiceId ?? null,
    kind: input.kind,
    field: input.field ?? null,
    old_value: input.oldValue === null || input.oldValue === undefined ? null : String(input.oldValue),
    new_value: input.newValue === null || input.newValue === undefined ? null : String(input.newValue),
    reason: input.reason ?? null,
    actor_id: input.actorId,
  });
  if (error) console.error('[billing] could not record event', { kind: input.kind, customerId: input.customerId, error });
}

/** One override event per field that actually changed. */
export async function recordOverrides(
  admin: ReturnType<typeof createAdminClient>,
  base: Omit<BillingEventInput, 'kind' | 'field' | 'oldValue' | 'newValue'>,
  before: Record<string, string | number | null>,
  after: Record<string, string | number | null>,
): Promise<void> {
  for (const field of Object.keys(after)) {
    if (before[field] === after[field]) continue;
    await recordBillingEvent(admin, { ...base, kind: EVENT_KIND.override, field, oldValue: before[field], newValue: after[field] });
  }
}
