// Everything the invoice page shows, for one invoice under one customer:
// the invoice, who it bills, the settings (payment terms, tax), the live
// plans and the customer's other invoices (so a draft can propose term
// lines and know whether they are an onboarding or a renewal), and this
// invoice's own events for the history card.

import type { createAdminClient } from '@/lib/supabase/admin';
import {
  INVOICE_COLUMNS, SUBSCRIPTION_COLUMNS, loadSettings, toInvoice, toSubscription,
  type InvoiceRow, type SubscriptionRow,
} from '@/lib/billing/detail';
import type { BillingEvent, BillingSettings, Invoice, Subscription } from '@/types/billing';

type Admin = ReturnType<typeof createAdminClient>;

type CustomerRow = { id: string; name: string; email: string | null };
type EventRow = {
  id: string; kind: string; field: string | null; old_value: string | null; new_value: string | null;
  reason: string | null; created_at: string;
};

export type InvoicePageData = {
  now: number;
  invoice: Invoice;
  customer: CustomerRow;
  settings: BillingSettings;
  subscriptions: Subscription[];
  /** Every invoice of the customer, this one included, newest first. */
  invoices: Invoice[];
  /** Events on this invoice, oldest first: the order a history reads in. */
  events: BillingEvent[];
};

export async function loadInvoicePage(
  admin: Admin,
  customerId: string,
  invoiceId: string,
  now: number = Date.now(),
): Promise<InvoicePageData | null> {
  const [invRes, customerRes, settings, subsRes, allRes, eventsRes] = await Promise.all([
    admin.from('invoices').select(INVOICE_COLUMNS).eq('id', invoiceId).eq('customer_id', customerId).maybeSingle(),
    admin.from('customers').select('id, name, email').eq('id', customerId).maybeSingle(),
    loadSettings(admin),
    admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('customer_id', customerId).order('created_at'),
    admin.from('invoices').select(INVOICE_COLUMNS).eq('customer_id', customerId).order('created_at', { ascending: false }),
    admin.from('billing_events')
      .select('id, kind, field, old_value, new_value, reason, created_at')
      .eq('invoice_id', invoiceId).order('created_at'),
  ]);
  if (invRes.error) throw new Error(`invoices: ${invRes.error.message}`);
  if (customerRes.error) throw new Error(`customers: ${customerRes.error.message}`);
  if (!invRes.data || !customerRes.data) return null;
  if (subsRes.error) throw new Error(`subscriptions: ${subsRes.error.message}`);
  if (allRes.error) throw new Error(`invoices: ${allRes.error.message}`);
  if (eventsRes.error) throw new Error(`billing_events: ${eventsRes.error.message}`);

  const invoice = toInvoice(invRes.data as unknown as InvoiceRow, now);
  return {
    now,
    invoice,
    customer: customerRes.data as CustomerRow,
    settings,
    subscriptions: (subsRes.data as unknown as SubscriptionRow[]).map(toSubscription),
    invoices: (allRes.data as unknown as InvoiceRow[]).map(r => toInvoice(r, now)),
    events: (eventsRes.data as EventRow[]).map((e): BillingEvent => ({
      id: e.id, kind: e.kind, field: e.field, oldValue: e.old_value, newValue: e.new_value, reason: e.reason,
      createdAt: e.created_at, invoiceNumber: invoice.number, subscriptionLabel: null,
    })),
  };
}
