import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow } from '@/lib/billing/route-helpers';
import { EVENT_KIND, recordBillingEvent } from '@/lib/billing/events';
import { optionalText, requireDate, requireMoney, requirePaymentMethod, requireUuid, MAX_LABEL } from '@/lib/billing/validate';

// Record money received against one invoice. Partial payments are fine; the
// database marks the invoice paid once the recorded total covers it.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin, actorId } = ctx;

  try {
    const customerId = requireUuid((await params).id, 'customer');
    const body = await readJson(request);
    const invoiceId = requireUuid(body.invoiceId, 'invoice');
    const amount = requireMoney(body.amount, 'amount', { min: 0.01 });
    const paidOn = requireDate(body.paidOn, 'payment date');
    const method = requirePaymentMethod(body.method);
    const reference = optionalText(body.reference, 'reference', MAX_LABEL);
    const notes = optionalText(body.notes, 'notes');

    // The invoice must belong to this customer: a payment against someone
    // else's invoice would settle the wrong account.
    const { data: invoice, error: readError } = await admin.from('invoices')
      .select('id, number').eq('id', invoiceId).eq('customer_id', customerId).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { error } = await admin.from('payments').insert({
      invoice_id: invoiceId, customer_id: customerId, amount, paid_on: paidOn, method, reference, notes, created_by: actorId,
    });
    ruleOrThrow(error);

    await recordBillingEvent(admin, {
      customerId, actorId, kind: EVENT_KIND.payment, invoiceId, field: method, newValue: amount, reason: reference,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failureResponse('record payment', error);
  }
}
