// The covering email an invoice goes out with. Short, plain, and the PDF
// carries everything else. Parts of the body come from the database, so the
// HTML part is built through the escaping renderer.

import { formatDate, formatMoney } from '@/lib/format';
import { plainTextEmailHtml } from './plain-text';
import type { BillingSettings, Invoice } from '@/types/billing';

export function invoiceEmailSubject(invoice: Invoice, settings: BillingSettings): string {
  return `${settings.companyName} invoice ${invoice.number} · ${formatMoney(invoice.total)}`;
}

export function invoiceEmailText(invoice: Invoice, customerName: string, settings: BillingSettings): string {
  const pay = [
    settings.bankName && `Bank: ${settings.bankName}`,
    settings.accountName && `Account name: ${settings.accountName}`,
    settings.iban && `IBAN: ${settings.iban}`,
    settings.fawranAlias && `Fawran alias: ${settings.fawranAlias}`,
  ].filter((l): l is string => Boolean(l));

  return [
    `Dear ${customerName},`,
    '',
    `Please find attached invoice ${invoice.number} for ${formatMoney(invoice.total)}, due ${formatDate(invoice.dueOn)}.`,
    '',
    ...(pay.length ? ['Payment details:', ...pay, '', `Please quote ${invoice.number} with your transfer.`, ''] : []),
    settings.billingEmail ? `Questions about this invoice: ${settings.billingEmail}` : null,
    '',
    settings.companyName,
  ].filter((l): l is string => l !== null).join('\n');
}

export function invoiceEmailHtml(text: string): string {
  return plainTextEmailHtml(text);
}
