// One invoice with everything the PDF and the covering email need: its
// lines and payments, the customer it bills, and the settings row.

import type { createAdminClient } from '@/lib/supabase/admin';
import { INVOICE_COLUMNS, loadSettings, toInvoice, type InvoiceRow } from '@/lib/billing/detail';
import type { InvoiceCustomer } from '@/lib/billing/invoice-pdf';
import type { BillingSettings, Invoice } from '@/types/billing';

type CustomerRow = { name: string; contact_name: string | null; email: string | null; phone: string | null };

export type InvoiceBundle = { invoice: Invoice; customer: InvoiceCustomer; settings: BillingSettings };

export async function loadInvoiceBundle(
  admin: ReturnType<typeof createAdminClient>,
  invoiceId: string,
  now: number = Date.now(),
): Promise<InvoiceBundle | null> {
  const { data: row, error } = await admin.from('invoices').select(INVOICE_COLUMNS).eq('id', invoiceId).maybeSingle();
  if (error) throw new Error(`invoices: ${error.message}`);
  if (!row) return null;
  const invoice = toInvoice(row as unknown as InvoiceRow, now);

  const [{ data: customer, error: customerError }, settings] = await Promise.all([
    admin.from('customers').select('name, contact_name, email, phone').eq('id', invoice.customerId).single(),
    loadSettings(admin),
  ]);
  if (customerError) throw new Error(`customers: ${customerError.message}`);
  const c = customer as CustomerRow;

  return {
    invoice,
    customer: { name: c.name, contactName: c.contact_name, email: c.email, phone: c.phone },
    settings,
  };
}
