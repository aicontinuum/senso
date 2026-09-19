import type { BillingStatus } from '@senso/types';
import type { StatusTone } from '@senso/ui';
import type { BillingTier, InvoiceState, InvoiceType, PaymentMethod } from '@/types/billing';

// Labels and tones for the billing vocabulary. The words come from SENSO.md;
// the tones reuse the status ramp so an overdue account reads the way an
// out-of-range fridge does, at a glance and without reading the word.

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  active: 'Active',
  overdue: 'Overdue',
  suspended: 'Suspended',
};

export const BILLING_STATUS_TONE: Record<BillingStatus, StatusTone> = {
  active: 'ok',
  overdue: 'alert',
  suspended: 'offline',
};

/** The order the status filter and the summary counts list them in. */
export const BILLING_STATUSES: readonly BillingStatus[] = ['active', 'overdue', 'suspended'];

export const TIER_LABEL: Record<BillingTier, string> = {
  starter: 'Starter',
  standard: 'Standard',
  custom: 'Custom',
};

export const INVOICE_TYPE_LABEL: Record<InvoiceType, string> = {
  onboarding: 'Onboarding',
  renewal: 'Renewal',
  adjustment: 'Adjustment',
};

export const INVOICE_STATE_LABEL: Record<InvoiceState, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  void: 'Void',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  cheque: 'Cheque',
};

/** Where a customer's billing detail lives. */
export function billingDetailHref(customerId: string): string {
  return `/billing/${customerId}`;
}
