// Row shapes for the billing tables and the `customer_billing_summary` view
// (supabase/migrations/20260919_billing.sql). Money columns are numeric in
// Postgres and arrive as strings through supabase-js; the loaders in
// lib/billing parse them once so components only ever see numbers.

import type { BillingStatus } from '@senso/types';

export type BillingTier = 'starter' | 'standard' | 'custom';
export type InvoiceType = 'onboarding' | 'renewal' | 'adjustment';
export type InvoiceState = 'draft' | 'sent' | 'paid' | 'void';
export type DiscountType = 'amount' | 'percent';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'cheque';
export type TermMonths = 6 | 12;

/** One row of `customer_billing_summary`, as the database returns it. */
export type CustomerBillingSummaryRow = {
  customer_id: string;
  name: string;
  email: string | null;
  billing_status: BillingStatus;
  suspended_at: string | null;
  tier: BillingTier | null;
  subscription_count: number | null;
  sensor_count: number;
  term_months: number | null;
  term_total: string | null;
  annualised: string;
  next_renewal: string | null;
  days_to_renewal: number | null;
  outstanding: string;
  overdue_amount: string;
  days_overdue: number;
  suspension_candidate: boolean;
  awaiting_first_payment: boolean;
  renewal_needs_invoice: boolean;
  last_payment_on: string | null;
};

/** The same row with money parsed, ready for a component. */
export type CustomerBilling = {
  customerId: string;
  name: string;
  email: string | null;
  status: BillingStatus;
  tier: BillingTier | null;
  subscriptionCount: number;
  sensorCount: number;
  termMonths: TermMonths | null;
  termTotal: number | null;
  annualised: number;
  nextRenewal: string | null;
  daysToRenewal: number | null;
  outstanding: number;
  overdueAmount: number;
  daysOverdue: number;
  suspensionCandidate: boolean;
  awaitingFirstPayment: boolean;
  renewalNeedsInvoice: boolean;
  lastPaymentOn: string | null;
};

/** An issued, unpaid invoice as the Needs Action list shows it. */
export type OpenInvoice = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  type: InvoiceType;
  total: number;
  issuedOn: string;
  dueOn: string;
  /** Negative while not yet due, zero on the day, positive once late. */
  daysOverdue: number;
};

/** A subscription renewing inside the notice window. */
export type UpcomingRenewal = {
  subscriptionId: string;
  customerId: string;
  customerName: string;
  label: string | null;
  renewalDate: string;
  daysToRenewal: number;
  termTotal: number;
};

export type BillingSummary = {
  annualised: number;
  outstanding: number;
  overdueAmount: number;
  overdueCustomers: number;
  renewalsDueCount: number;
  renewalsDueValue: number;
  byStatus: Record<BillingStatus, number>;
};

export type NeedsAction = {
  renewalsNeedingInvoice: UpcomingRenewal[];
  unpaid: OpenInvoice[];
  overdue: OpenInvoice[];
  suspensionCandidates: CustomerBilling[];
  awaitingFirstPayment: CustomerBilling[];
};
