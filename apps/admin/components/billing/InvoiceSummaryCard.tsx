import { Card } from '@senso/ui';
import { formatDate, formatMoney } from '@/lib/format';
import { balanceOf } from '@/lib/billing/pricing';
import type { Invoice } from '@/types/billing';

// The figures of an issued invoice at a glance: the dates and the money,
// balance last because it is the number you came for. Overdue turns the
// due date and the balance red; nothing else is tinted.

function Figure({ label, tone, children }: { label: string; tone?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-medium tabular-nums ${tone ?? ''}`}>{children}</p>
    </div>
  );
}

export function InvoiceSummaryCard({ invoice }: { invoice: Invoice }) {
  const balance = balanceOf(invoice);
  const late = invoice.overdue ? 'text-alert-text' : undefined;
  return (
    <Card className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4 lg:grid-cols-8">
      <Figure label="Issued">{formatDate(invoice.issuedOn)}</Figure>
      <Figure label="Due" tone={late}>{formatDate(invoice.dueOn)}</Figure>
      <Figure label="Subtotal">{formatMoney(invoice.subtotal)}</Figure>
      <Figure label={invoice.discountLabel ? `Discount · ${invoice.discountLabel}` : 'Discount'}>
        {invoice.discountAmount > 0 ? `−${formatMoney(invoice.discountAmount)}` : '—'}
      </Figure>
      <Figure label={invoice.taxRate > 0 ? `Tax (${invoice.taxRate * 100}%)` : 'Tax'}>
        {invoice.taxAmount > 0 ? formatMoney(invoice.taxAmount) : '—'}
      </Figure>
      <Figure label="Total">{formatMoney(invoice.total)}</Figure>
      <Figure label="Paid">{invoice.paid > 0 ? formatMoney(invoice.paid) : '—'}</Figure>
      <Figure label="Balance" tone={invoice.state === 'void' ? 'text-muted-foreground' : balance > 0 ? late : 'text-ok-text'}>
        {invoice.state === 'void' ? '—' : formatMoney(balance)}
      </Figure>
    </Card>
  );
}
