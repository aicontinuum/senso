// Everything the top-level Billing page shows, from four reads.
//
// The per-customer figures come from `customer_billing_summary`, so the table,
// the summary strip and the Needs Action lists are all the same numbers and can
// never disagree. Open invoices and upcoming renewals are read directly because
// the view aggregates them per customer and the lists need each one.
//
// A read that fails is thrown, not swallowed: a billing page that quietly shows
// zero outstanding on a failed query is worse than an error page.

import type { BillingStatus } from '@senso/types';
import type { createAdminClient } from '@/lib/supabase/admin';
import { daysUntil, parseMoney, todayIso } from '@/lib/format';
import { BILLING_STATUSES } from '@/lib/billing/constants';
import { loadInstalledSensorCounts, sensorsMismatch } from '@/lib/billing/installed-sensors';
import type {
  BillingSummary, CustomerBilling, CustomerBillingSummaryRow, NeedsAction, OpenInvoice,
  TermMonths, UpcomingRenewal, InvoiceType,
} from '@/types/billing';

type Admin = ReturnType<typeof createAdminClient>;

export type BillingOverview = {
  customers: CustomerBilling[];
  summary: BillingSummary;
  needsAction: NeedsAction;
  renewalNoticeDays: number;
};

const SUMMARY_COLUMNS =
  'customer_id, name, email, billing_status, suspended_at, tier, subscription_count, sensor_count, '
  + 'term_months, term_total, annualised, next_renewal, days_to_renewal, outstanding, overdue_amount, '
  + 'days_overdue, suspension_candidate, awaiting_first_payment, renewal_needs_invoice, last_payment_on';

type OpenInvoiceRow = {
  id: string; number: string; customer_id: string; type: InvoiceType; total: string;
  issued_on: string; due_on: string; customers: { name: string } | null;
};

type RenewalRow = {
  id: string; customer_id: string; label: string | null; renewal_date: string; term_total: string;
  customers: { name: string } | null;
};

export function toCustomerBilling(row: CustomerBillingSummaryRow, installedSensors: number): CustomerBilling {
  return {
    customerId: row.customer_id,
    name: row.name,
    email: row.email,
    status: row.billing_status,
    suspendedAt: row.suspended_at,
    tier: row.tier,
    subscriptionCount: row.subscription_count ?? 0,
    sensorCount: row.sensor_count,
    installedSensors,
    sensorMismatch: sensorsMismatch(row.sensor_count, installedSensors, (row.subscription_count ?? 0) > 0),
    termMonths: row.term_months === 6 || row.term_months === 12 ? (row.term_months as TermMonths) : null,
    termTotal: row.term_total === null ? null : parseMoney(row.term_total),
    annualised: parseMoney(row.annualised),
    nextRenewal: row.next_renewal,
    daysToRenewal: row.days_to_renewal,
    outstanding: parseMoney(row.outstanding),
    overdueAmount: parseMoney(row.overdue_amount),
    daysOverdue: row.days_overdue,
    suspensionCandidate: row.suspension_candidate,
    awaitingFirstPayment: row.awaiting_first_payment,
    renewalNeedsInvoice: row.renewal_needs_invoice,
    lastPaymentOn: row.last_payment_on,
  };
}

export async function loadBillingOverview(admin: Admin, now: number = Date.now()): Promise<BillingOverview> {
  const today = todayIso(now);

  const { data: settings, error: settingsError } = await admin
    .from('billing_settings').select('renewal_notice_days').eq('id', true).single();
  if (settingsError) throw new Error(`billing_settings: ${settingsError.message}`);
  const renewalNoticeDays: number = settings.renewal_notice_days;

  const windowEnd = new Date(now + renewalNoticeDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [summaryRes, invoicesRes, renewalsRes, installed] = await Promise.all([
    admin.from('customer_billing_summary').select(SUMMARY_COLUMNS).order('name'),
    admin.from('invoices')
      .select('id, number, customer_id, type, total, issued_on, due_on, customers (name)')
      .eq('state', 'sent')
      .order('due_on'),
    admin.from('subscriptions')
      .select('id, customer_id, label, renewal_date, term_total, customers (name)')
      .is('ended_at', null)
      .gte('renewal_date', today)
      .lte('renewal_date', windowEnd)
      .order('renewal_date'),
    loadInstalledSensorCounts(admin),
  ]);
  if (summaryRes.error) throw new Error(`customer_billing_summary: ${summaryRes.error.message}`);
  if (invoicesRes.error) throw new Error(`invoices: ${invoicesRes.error.message}`);
  if (renewalsRes.error) throw new Error(`subscriptions: ${renewalsRes.error.message}`);

  const customers = (summaryRes.data as unknown as CustomerBillingSummaryRow[])
    .map(row => toCustomerBilling(row, installed.get(row.customer_id) ?? 0));
  const byId = new Map(customers.map(c => [c.customerId, c]));

  const openInvoices: OpenInvoice[] = (invoicesRes.data as unknown as OpenInvoiceRow[]).map(r => ({
    id: r.id,
    number: r.number,
    customerId: r.customer_id,
    customerName: r.customers?.name ?? byId.get(r.customer_id)?.name ?? 'Unknown customer',
    type: r.type,
    total: parseMoney(r.total),
    issuedOn: r.issued_on,
    dueOn: r.due_on,
    daysOverdue: -daysUntil(r.due_on, now),
  }));

  const renewals: UpcomingRenewal[] = (renewalsRes.data as unknown as RenewalRow[]).map(r => ({
    subscriptionId: r.id,
    customerId: r.customer_id,
    customerName: r.customers?.name ?? byId.get(r.customer_id)?.name ?? 'Unknown customer',
    label: r.label,
    renewalDate: r.renewal_date,
    daysToRenewal: daysUntil(r.renewal_date, now),
    termTotal: parseMoney(r.term_total),
  }));

  const byStatus = Object.fromEntries(BILLING_STATUSES.map(s => [s, 0])) as Record<BillingStatus, number>;
  for (const c of customers) byStatus[c.status]++;

  const summary: BillingSummary = {
    annualised: customers.reduce((sum, c) => sum + c.annualised, 0),
    outstanding: customers.reduce((sum, c) => sum + c.outstanding, 0),
    overdueAmount: customers.reduce((sum, c) => sum + c.overdueAmount, 0),
    overdueCustomers: customers.filter(c => c.overdueAmount > 0).length,
    renewalsDueCount: renewals.length,
    renewalsDueValue: renewals.reduce((sum, r) => sum + r.termTotal, 0),
    byStatus,
  };

  const needsAction: NeedsAction = {
    renewalsNeedingInvoice: renewals.filter(r => byId.get(r.customerId)?.renewalNeedsInvoice),
    unpaid: openInvoices.filter(i => i.daysOverdue <= 0),
    overdue: openInvoices.filter(i => i.daysOverdue > 0).sort((a, b) => b.daysOverdue - a.daysOverdue),
    suspensionCandidates: customers.filter(c => c.suspensionCandidate).sort((a, b) => b.daysOverdue - a.daysOverdue),
    awaitingFirstPayment: customers.filter(c => c.awaitingFirstPayment),
    sensorMismatches: customers.filter(c => c.sensorMismatch),
  };

  return { customers, summary, needsAction, renewalNoticeDays };
}
