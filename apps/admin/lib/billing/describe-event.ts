// One sentence per change-log event, shared by the customer's change log
// and the invoice history so the same event never reads two ways.

import { EVENT_KIND } from '@/lib/billing/events';
import { PAYMENT_METHOD_LABEL } from '@/lib/billing/constants';
import type { BillingEvent, PaymentMethod } from '@/types/billing';

const FIELD_LABEL: Record<string, string> = {
  monthly_rate: 'monthly rate', addon_monthly_rate: 'add-on rate', term_total: 'term total', renewal_date: 'renewal date',
  term_start: 'term start', term_months: 'term', sensor_count: 'sensors', addon_count: 'add-ons', tier: 'tier', label: 'label', status: 'status',
};

export function describeBillingEvent(e: BillingEvent): string {
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

/** The same sentence with the invoice reference dropped: on the invoice's own
 *  page every line is about it, so "(BT-2026-0007)" would repeat on each. */
export function describeInvoiceEvent(e: BillingEvent): string {
  switch (e.kind) {
    case EVENT_KIND.invoiceIssued: return `Issued as ${e.newValue ?? ''}`;
    case EVENT_KIND.invoiceVoided: return 'Voided';
    case EVENT_KIND.invoiceSent: return `Emailed${e.newValue ? ` to ${e.newValue}` : ''}`;
    case EVENT_KIND.payment: return `Payment of ${e.newValue ?? ''} by ${(PAYMENT_METHOD_LABEL[e.field as PaymentMethod] ?? e.field ?? '').toLowerCase()}`;
    default: return describeBillingEvent({ ...e, invoiceNumber: null });
  }
}
