import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow } from '@/lib/billing/route-helpers';
import { EVENT_KIND, recordBillingEvent } from '@/lib/billing/events';
import { requireText, requireUuid } from '@/lib/billing/validate';

// Void an issued invoice. The number stays, the reason is stored on the
// invoice and in the log. A paid invoice cannot be voided; the database
// says so and the message is passed through.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin, actorId } = ctx;

  try {
    const id = requireUuid((await params).id, 'invoice');
    const body = await readJson(request);
    const reason = requireText(body.reason, 'reason');

    const { data: head, error: readError } = await admin.from('invoices').select('customer_id, number').eq('id', id).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!head) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { error } = await admin.rpc('void_invoice', { p_invoice_id: id, p_reason: reason });
    ruleOrThrow(error);

    await recordBillingEvent(admin, {
      customerId: head.customer_id, actorId, kind: EVENT_KIND.invoiceVoided, invoiceId: id, oldValue: head.number, reason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failureResponse('void invoice', error);
  }
}
