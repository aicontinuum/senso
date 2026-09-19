import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow } from '@/lib/billing/route-helpers';
import { EVENT_KIND, recordBillingEvent } from '@/lib/billing/events';
import { optionalDate, requireUuid } from '@/lib/billing/validate';
import { todayIso } from '@/lib/format';

// Issue a draft: the database assigns the next number for the year under a
// lock, freezes the content and marks it sent. Emailing the PDF is a separate
// step (and its own event) so an invoice can be issued and handed over by
// hand without pretending an email went out.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin, actorId } = ctx;

  try {
    const id = requireUuid((await params).id, 'invoice');
    const body = await readJson(request).catch(() => ({} as Record<string, unknown>));
    const issuedOn = optionalDate(body.issuedOn, 'issue date') ?? todayIso();

    const { data: head, error: readError } = await admin.from('invoices').select('customer_id, total').eq('id', id).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!head) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { data: number, error } = await admin.rpc('issue_invoice', { p_invoice_id: id, p_issued_on: issuedOn });
    ruleOrThrow(error);

    await recordBillingEvent(admin, {
      customerId: head.customer_id, actorId, kind: EVENT_KIND.invoiceIssued, invoiceId: id, newValue: number as string,
    });
    return NextResponse.json({ number });
  } catch (error) {
    return failureResponse('issue invoice', error);
  }
}
