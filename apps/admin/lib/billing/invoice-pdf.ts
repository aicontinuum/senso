// The invoice as a PDF. Built on the server from the stored invoice, so what
// prints is exactly what was issued: the frozen lines and totals, the number
// the database assigned, and Bloctech's details as they were in settings at
// the moment of printing. A draft prints too, marked DRAFT, for checking a
// figure before it is issued.

import { jsPDF } from 'jspdf';
import { formatDate, formatMoney } from '@/lib/format';
import { INVOICE_TYPE_LABEL } from '@/lib/billing/constants';
import type { BillingSettings, Invoice } from '@/types/billing';

export type InvoiceCustomer = {
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
};

const PAGE_W = 210;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const INK: [number, number, number] = [24, 24, 32];
const MUTED: [number, number, number] = [110, 110, 125];
const RULE: [number, number, number] = [220, 220, 229];
const STAMP: [number, number, number] = [200, 200, 210];

function stampFor(invoice: Invoice): string | null {
  if (invoice.state === 'draft') return 'DRAFT';
  if (invoice.state === 'void') return 'VOID';
  if (invoice.state === 'paid') return 'PAID';
  return null;
}

export function invoiceFilename(invoice: Invoice): string {
  return `${invoice.number ?? 'draft-invoice'}.pdf`;
}

export function buildInvoicePdf(invoice: Invoice, customer: InvoiceCustomer, settings: BillingSettings): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  const text = (s: string, x: number, size: number, opts: { bold?: boolean; muted?: boolean; align?: 'left' | 'right' } = {}) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(...(opts.muted ? MUTED : INK));
    doc.text(s, x, y, { align: opts.align ?? 'left' });
  };
  const rule = () => { doc.setDrawColor(...RULE); doc.line(MARGIN, y, MARGIN + CONTENT_W, y); };

  // Header: who is invoicing, and the word INVOICE with its number.
  text(settings.companyName, MARGIN, 16, { bold: true });
  text('INVOICE', PAGE_W - MARGIN, 16, { bold: true, align: 'right' });
  y += 6;
  const companyLines = [
    settings.crNumber ? `CR ${settings.crNumber}` : null,
    settings.address, settings.phone, settings.billingEmail,
    settings.taxRegistrationNumber ? `Tax reg. ${settings.taxRegistrationNumber}` : null,
  ].filter((l): l is string => Boolean(l));
  const headerTop = y;
  for (const line of companyLines) { text(line, MARGIN, 9, { muted: true }); y += 4.5; }
  const afterCompany = y;
  y = headerTop;
  const meta: [string, string][] = [
    ['Number', invoice.number ?? 'Draft'],
    ['Type', INVOICE_TYPE_LABEL[invoice.type]],
    ['Issued', formatDate(invoice.issuedOn)],
    ['Due', formatDate(invoice.dueOn)],
  ];
  for (const [k, v] of meta) {
    text(k, PAGE_W - MARGIN - 32, 9, { muted: true, align: 'right' });
    text(v, PAGE_W - MARGIN, 9, { bold: true, align: 'right' });
    y += 4.5;
  }
  y = Math.max(afterCompany, y) + 6;
  rule();
  y += 8;

  // Bill to.
  text('BILL TO', MARGIN, 8, { muted: true, bold: true });
  y += 5;
  text(customer.name, MARGIN, 11, { bold: true });
  y += 5;
  for (const line of [customer.contactName, customer.email, customer.phone].filter((l): l is string => Boolean(l))) {
    text(line, MARGIN, 9, { muted: true }); y += 4.5;
  }
  y += 6;

  // Lines.
  const colQty = MARGIN + 118, colUnit = MARGIN + 146, colAmt = PAGE_W - MARGIN;
  text('Description', MARGIN, 8, { muted: true, bold: true });
  text('Qty', colQty, 8, { muted: true, bold: true, align: 'right' });
  text('Unit', colUnit, 8, { muted: true, bold: true, align: 'right' });
  text('Amount', colAmt, 8, { muted: true, bold: true, align: 'right' });
  y += 2.5; rule(); y += 5.5;
  for (const line of invoice.lines) {
    const wrapped = doc.splitTextToSize(line.description, 100) as string[];
    text(wrapped[0], MARGIN, 10);
    text(String(line.quantity), colQty, 10, { align: 'right' });
    text(formatMoney(line.unitAmount), colUnit, 10, { align: 'right' });
    text(formatMoney(line.amount), colAmt, 10, { align: 'right' });
    for (const extra of wrapped.slice(1)) { y += 4.5; text(extra, MARGIN, 10); }
    y += 6.5;
    if (y > 250) { doc.addPage(); y = MARGIN; }
  }
  y += 1; rule(); y += 7;

  // Totals.
  const totals: [string, string, boolean][] = [['Subtotal', formatMoney(invoice.subtotal), false]];
  if (invoice.discountAmount > 0) totals.push([invoice.discountLabel ? `Discount (${invoice.discountLabel})` : 'Discount', `−${formatMoney(invoice.discountAmount)}`, false]);
  if (invoice.taxRate > 0) totals.push([`Tax ${invoice.taxRate * 100}%`, formatMoney(invoice.taxAmount), false]);
  totals.push(['Total due', formatMoney(invoice.total), true]);
  if (invoice.paid > 0 && invoice.state !== 'void') {
    totals.push(['Paid', `−${formatMoney(invoice.paid)}`, false]);
    totals.push(['Balance', formatMoney(Math.max(0, invoice.total - invoice.paid)), true]);
  }
  for (const [k, v, bold] of totals) {
    text(k, colUnit, bold ? 11 : 10, { muted: !bold, bold, align: 'right' });
    text(v, colAmt, bold ? 11 : 10, { bold, align: 'right' });
    y += bold ? 7 : 5.5;
  }
  y += 6;

  // How to pay. Whichever of IBAN and Fawran is set is printed.
  const pay = [
    settings.bankName ? `Bank: ${settings.bankName}` : null,
    settings.accountName ? `Account name: ${settings.accountName}` : null,
    settings.iban ? `IBAN: ${settings.iban}` : null,
    settings.fawranAlias ? `Fawran alias: ${settings.fawranAlias}` : null,
  ].filter((l): l is string => Boolean(l));
  if (pay.length > 0 && invoice.state !== 'void') {
    rule(); y += 7;
    text('PAYMENT DETAILS', MARGIN, 8, { muted: true, bold: true });
    y += 5;
    for (const line of pay) { text(line, MARGIN, 10); y += 5; }
    if (invoice.number) { y += 1; text(`Please quote ${invoice.number} with your transfer.`, MARGIN, 9, { muted: true }); y += 5; }
  }

  // Stamp: a large faint word across the page for anything that is not a live, unpaid invoice.
  const stamp = stampFor(invoice);
  if (stamp) {
    doc.setFontSize(72);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...STAMP);
    doc.text(stamp, PAGE_W / 2, 160, { align: 'center', angle: 30 });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
