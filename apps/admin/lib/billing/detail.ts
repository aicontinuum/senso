// Everything the customer billing detail page shows, for one customer.
// Row shapes from Postgres are mapped once here; components see only the
// parsed types in types/billing.ts.

import type { createAdminClient } from '@/lib/supabase/admin';
import { daysUntil, parseMoney } from '@/lib/format';
import { toCustomerBilling } from '@/lib/billing/overview';
import { loadInstalledSensorCounts } from '@/lib/billing/installed-sensors';
import type {
  BillingEvent, BillingNote, BillingSettings, CustomerBillingDetail, CustomerBillingSummaryRow,
  Invoice, InvoiceLine, Payment, Subscription, TermMonths,
  BillingTier, InvoiceType, InvoiceState, DiscountType, PaymentMethod,
} from '@/types/billing';

type Admin = ReturnType<typeof createAdminClient>;

type SettingsRow = {
  company_name: string; cr_number: string | null; address: string | null; phone: string | null; billing_email: string | null;
  logo_url: string | null; bank_name: string | null; account_name: string | null; iban: string | null; fawran_alias: string | null;
  tax_registration_number: string | null; tax_rate: string; invoice_prefix: string; payment_terms_days: number;
  renewal_notice_days: number; suspension_after_days: number; starter_monthly: string; standard_monthly: string;
  addon_monthly: string; addon_monthly_custom: string;
};

export const SETTINGS_COLUMNS =
  'company_name, cr_number, address, phone, billing_email, logo_url, bank_name, account_name, iban, fawran_alias, '
  + 'tax_registration_number, tax_rate, invoice_prefix, payment_terms_days, renewal_notice_days, suspension_after_days, '
  + 'starter_monthly, standard_monthly, addon_monthly, addon_monthly_custom';

export function toSettings(row: SettingsRow): BillingSettings {
  return {
    companyName: row.company_name,
    crNumber: row.cr_number,
    address: row.address,
    phone: row.phone,
    billingEmail: row.billing_email,
    logoUrl: row.logo_url,
    bankName: row.bank_name,
    accountName: row.account_name,
    iban: row.iban,
    fawranAlias: row.fawran_alias,
    taxRegistrationNumber: row.tax_registration_number,
    taxRate: parseMoney(row.tax_rate),
    invoicePrefix: row.invoice_prefix,
    paymentTermsDays: row.payment_terms_days,
    renewalNoticeDays: row.renewal_notice_days,
    suspensionAfterDays: row.suspension_after_days,
    starterMonthly: parseMoney(row.starter_monthly),
    standardMonthly: parseMoney(row.standard_monthly),
    addonMonthly: parseMoney(row.addon_monthly),
    addonMonthlyCustom: parseMoney(row.addon_monthly_custom),
  };
}

export async function loadSettings(admin: Admin): Promise<BillingSettings> {
  const { data, error } = await admin.from('billing_settings').select(SETTINGS_COLUMNS).eq('id', true).single();
  if (error) throw new Error(`billing_settings: ${error.message}`);
  return toSettings(data as unknown as SettingsRow);
}

export type SubscriptionRow = {
  id: string; customer_id: string; label: string | null; tier: BillingTier; sensor_count: number; addon_count: number;
  addon_monthly_rate: string; term_months: number; monthly_rate: string; term_total: string; term_start: string | null;
  renewal_date: string | null; ended_at: string | null; created_at: string;
};

export const SUBSCRIPTION_COLUMNS =
  'id, customer_id, label, tier, sensor_count, addon_count, addon_monthly_rate, term_months, monthly_rate, '
  + 'term_total, term_start, renewal_date, ended_at, created_at';

export function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    customerId: row.customer_id,
    label: row.label,
    tier: row.tier,
    sensorCount: row.sensor_count,
    addonCount: row.addon_count,
    addonMonthlyRate: parseMoney(row.addon_monthly_rate),
    termMonths: row.term_months as TermMonths,
    monthlyRate: parseMoney(row.monthly_rate),
    termTotal: parseMoney(row.term_total),
    termStart: row.term_start,
    renewalDate: row.renewal_date,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}

type LineRow = { id: string; position: number; description: string; quantity: string; unit_amount: string; amount: string };
type PaymentRow = {
  id: string; invoice_id: string; amount: string; paid_on: string; method: PaymentMethod; reference: string | null; notes: string | null;
};
export type InvoiceRow = {
  id: string; customer_id: string; subscription_id: string | null; type: InvoiceType; state: InvoiceState;
  number: string | null; issued_on: string | null; due_on: string | null; discount_label: string | null;
  discount_type: DiscountType | null; discount_value: string | null; subtotal: string; discount_amount: string;
  tax_rate: string; tax_amount: string; total: string; internal_notes: string | null; sent_at: string | null;
  sent_to: string[] | null; voided_at: string | null; void_reason: string | null; archived_at: string | null; created_at: string;
  invoice_lines: LineRow[]; payments: PaymentRow[];
};

export const INVOICE_COLUMNS =
  'id, customer_id, subscription_id, type, state, number, issued_on, due_on, discount_label, discount_type, '
  + 'discount_value, subtotal, discount_amount, tax_rate, tax_amount, total, internal_notes, sent_at, sent_to, '
  + 'voided_at, void_reason, archived_at, created_at, '
  + 'invoice_lines (id, position, description, quantity, unit_amount, amount), '
  + 'payments (id, invoice_id, amount, paid_on, method, reference, notes)';

function toLine(row: LineRow): InvoiceLine {
  return {
    id: row.id, position: row.position, description: row.description,
    quantity: parseMoney(row.quantity), unitAmount: parseMoney(row.unit_amount), amount: parseMoney(row.amount),
  };
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id, invoiceId: row.invoice_id, amount: parseMoney(row.amount), paidOn: row.paid_on,
    method: row.method, reference: row.reference, notes: row.notes,
  };
}

export function toInvoice(row: InvoiceRow, now: number): Invoice {
  const payments = (row.payments ?? []).map(toPayment).sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  return {
    id: row.id,
    customerId: row.customer_id,
    subscriptionId: row.subscription_id,
    type: row.type,
    state: row.state,
    number: row.number,
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    discountLabel: row.discount_label,
    discountType: row.discount_type,
    discountValue: row.discount_value === null ? null : parseMoney(row.discount_value),
    subtotal: parseMoney(row.subtotal),
    discountAmount: parseMoney(row.discount_amount),
    taxRate: parseMoney(row.tax_rate),
    taxAmount: parseMoney(row.tax_amount),
    total: parseMoney(row.total),
    internalNotes: row.internal_notes,
    sentAt: row.sent_at,
    sentTo: row.sent_to,
    voidedAt: row.voided_at,
    archivedAt: row.archived_at,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    lines: (row.invoice_lines ?? []).map(toLine).sort((a, b) => a.position - b.position),
    payments,
    paid: payments.reduce((sum, p) => sum + p.amount, 0),
    overdue: row.state === 'sent' && row.due_on !== null && daysUntil(row.due_on, now) < 0,
  };
}

type NoteRow = { id: string; body: string; created_at: string };
type EventRow = {
  id: string; kind: string; field: string | null; old_value: string | null; new_value: string | null;
  reason: string | null; created_at: string; invoices: { number: string | null } | null; subscriptions: { label: string | null } | null;
};

export async function loadCustomerBillingDetail(
  admin: Admin,
  customerId: string,
  now: number = Date.now(),
): Promise<CustomerBillingDetail | null> {
  const [summaryRes, settings, subsRes, invRes, notesRes, eventsRes, installed] = await Promise.all([
    admin.from('customer_billing_summary').select('*').eq('customer_id', customerId).maybeSingle(),
    loadSettings(admin),
    admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('customer_id', customerId).order('created_at'),
    admin.from('invoices').select(INVOICE_COLUMNS).eq('customer_id', customerId).order('created_at', { ascending: false }),
    admin.from('billing_notes').select('id, body, created_at').eq('customer_id', customerId).order('created_at', { ascending: false }),
    admin.from('billing_events')
      .select('id, kind, field, old_value, new_value, reason, created_at, invoices (number), subscriptions (label)')
      .eq('customer_id', customerId).order('created_at', { ascending: false }),
    loadInstalledSensorCounts(admin, customerId).then(m => m.get(customerId) ?? 0),
  ]);
  if (summaryRes.error) throw new Error(`customer_billing_summary: ${summaryRes.error.message}`);
  if (!summaryRes.data) return null;
  if (subsRes.error) throw new Error(`subscriptions: ${subsRes.error.message}`);
  if (invRes.error) throw new Error(`invoices: ${invRes.error.message}`);
  if (notesRes.error) throw new Error(`billing_notes: ${notesRes.error.message}`);
  if (eventsRes.error) throw new Error(`billing_events: ${eventsRes.error.message}`);

  return {
    now,
    customer: toCustomerBilling(summaryRes.data as unknown as CustomerBillingSummaryRow, installed),
    settings,
    subscriptions: (subsRes.data as unknown as SubscriptionRow[]).map(toSubscription),
    invoices: (invRes.data as unknown as InvoiceRow[]).map(r => toInvoice(r, now)),
    notes: (notesRes.data as NoteRow[]).map((n): BillingNote => ({ id: n.id, body: n.body, createdAt: n.created_at })),
    events: (eventsRes.data as unknown as EventRow[]).map((e): BillingEvent => ({
      id: e.id, kind: e.kind, field: e.field, oldValue: e.old_value, newValue: e.new_value, reason: e.reason,
      createdAt: e.created_at, invoiceNumber: e.invoices?.number ?? null, subscriptionLabel: e.subscriptions?.label ?? null,
    })),
  };
}
