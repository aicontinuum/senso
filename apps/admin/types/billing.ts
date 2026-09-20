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
  last_payment_on: string | null;
};

/** The same row with money parsed, ready for a component. */
export type CustomerBilling = {
  customerId: string;
  name: string;
  email: string | null;
  status: BillingStatus;
  suspendedAt: string | null;
  tier: BillingTier | null;
  subscriptionCount: number;
  /** What the plan charges for (sensors plus add-ons). */
  sensorCount: number;
  /** Live sensors registered to the customer, counted from the device tables. */
  installedSensors: number;
  /** A plan exists and its count is not what is installed. */
  sensorMismatch: boolean;
  termMonths: TermMonths | null;
  termTotal: number | null;
  annualised: number;
  nextRenewal: string | null;
  daysToRenewal: number | null;
  outstanding: number;
  overdueAmount: number;
  daysOverdue: number;
  suspensionCandidate: boolean;
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

/** The defaults row, money parsed. Every field is editable from Settings. */
export type BillingSettings = {
  companyName: string;
  crNumber: string | null;
  address: string | null;
  phone: string | null;
  billingEmail: string | null;
  logoUrl: string | null;
  bankName: string | null;
  accountName: string | null;
  iban: string | null;
  fawranAlias: string | null;
  taxRegistrationNumber: string | null;
  taxRate: number;
  invoicePrefix: string;
  paymentTermsDays: number;
  renewalNoticeDays: number;
  suspensionAfterDays: number;
  starterMonthly: number;
  standardMonthly: number;
  addonMonthly: number;
  addonMonthlyCustom: number;
};

export type Subscription = {
  id: string;
  customerId: string;
  label: string | null;
  tier: BillingTier;
  sensorCount: number;
  addonCount: number;
  addonMonthlyRate: number;
  termMonths: TermMonths;
  monthlyRate: number;
  termTotal: number;
  termStart: string | null;
  renewalDate: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type InvoiceLine = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
};

export type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
};

export type Invoice = {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  type: InvoiceType;
  state: InvoiceState;
  /** Null while draft. */
  number: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  discountLabel: string | null;
  discountType: DiscountType | null;
  discountValue: number | null;
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  internalNotes: string | null;
  sentAt: string | null;
  sentTo: string[] | null;
  voidedAt: string | null;
  voidReason: string | null;
  /** Set on a voided invoice the admin has tidied out of the list. */
  archivedAt: string | null;
  createdAt: string;
  lines: InvoiceLine[];
  payments: Payment[];
  /** Sum of payments; what is still owed is total minus this. */
  paid: number;
  /** True for a sent invoice past its due date. Derived, never stored. */
  overdue: boolean;
};

export type BillingEvent = {
  id: string;
  kind: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  invoiceNumber: string | null;
  subscriptionLabel: string | null;
};

export type CustomerBillingDetail = {
  /** Server clock at load, so every relative figure on the page agrees. */
  now: number;
  customer: CustomerBilling;
  settings: BillingSettings;
  subscriptions: Subscription[];
  invoices: Invoice[];
  events: BillingEvent[];
};

export type BillingSummary = {
  annualised: number;
  /** Every payment ever recorded, across all customers. */
  totalPaid: number;
  overdueAmount: number;
  overdueCustomers: number;
  renewalsDueCount: number;
  renewalsDueValue: number;
  byStatus: Record<BillingStatus, number>;
};

export type NeedsAction = {
  unpaid: OpenInvoice[];
  overdue: OpenInvoice[];
  suspensionCandidates: CustomerBilling[];
  /** Plan sensor count differs from what is installed. */
  sensorMismatches: CustomerBilling[];
};
