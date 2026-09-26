import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow, BillingRuleError } from '@/lib/billing/route-helpers';
import { EVENT_KIND, recordBillingEvent } from '@/lib/billing/events';
import { loadInvoiceBundle } from '@/lib/billing/invoice-load';
import { buildInvoicePdf, invoiceFilename } from '@/lib/billing/invoice-pdf';
import { BillingInputError, EMAIL_RE, requireUuid } from '@/lib/billing/validate';
import { emailConfigured, sendEmail } from '@/lib/email/send';
import { invoiceEmailHtml, invoiceEmailSubject, invoiceEmailText } from '@/lib/email/invoice-email';

// Email an issued invoice, PDF attached, through Resend. Recipients default
// to the customer's account email; the body may name others. Only an issued
// invoice goes out: a draft has no number and a void one is not owed. The
// send is recorded on the invoice (when, to whom) and in the change log.

const MAX_RECIPIENTS = 5;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin, actorId } = ctx;

  try {
    const id = requireUuid((await params).id, 'invoice');
    const body = await readJson(request).catch(() => ({} as Record<string, unknown>));

    if (!emailConfigured()) throw new BillingRuleError('Email is not configured on the server (RESEND_API_KEY / ALERT_FROM_EMAIL).');

    const bundle = await loadInvoiceBundle(admin, id);
    if (!bundle) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    const { invoice, customer, settings } = bundle;
    if (invoice.state === 'draft') throw new BillingRuleError('Issue the invoice before sending it.');
    if (invoice.state === 'void') throw new BillingRuleError(`Invoice ${invoice.number} is void and cannot be sent.`);

    const requested = Array.isArray(body.to) ? body.to : [];
    const to = (requested.length ? requested : [customer.email])
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(v => v !== '');
    if (to.length === 0) throw new BillingInputError('The customer has no email address; add one or enter a recipient.');
    if (to.length > MAX_RECIPIENTS) throw new BillingInputError(`At most ${MAX_RECIPIENTS} recipients.`);
    for (const address of to) if (!EMAIL_RE.test(address)) throw new BillingInputError(`${address} is not a valid email address.`);

    const text = invoiceEmailText(invoice, customer.name, settings);
    const result = await sendEmail({
      to,
      subject: invoiceEmailSubject(invoice, settings),
      text,
      html: invoiceEmailHtml(text),
      replyTo: settings.billingEmail ?? undefined,
      attachments: [{ filename: invoiceFilename(invoice), content: buildInvoicePdf(invoice, customer, settings) }],
    });
    if (!result.ok) throw new BillingRuleError(`The email provider refused the send (${result.error}). Nothing was recorded.`);

    const { error } = await admin.from('invoices').update({ sent_at: new Date().toISOString(), sent_to: to }).eq('id', id);
    ruleOrThrow(error);
    await recordBillingEvent(admin, {
      customerId: invoice.customerId, actorId, kind: EVENT_KIND.invoiceSent, invoiceId: id, newValue: to.join(', '),
    });

    return NextResponse.json({ ok: true, to });
  } catch (error) {
    return failureResponse('send invoice', error);
  }
}
