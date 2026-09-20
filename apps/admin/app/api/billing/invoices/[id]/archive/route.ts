import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow, BillingRuleError } from '@/lib/billing/route-helpers';
import { EVENT_KIND, recordBillingEvent } from '@/lib/billing/events';
import { BillingInputError, requireUuid } from '@/lib/billing/validate';

// Archive or unarchive an invoice. Only a voided invoice can be archived:
// anything still owed, or paid, belongs in the list. The record is not
// touched beyond the marker, and either direction is logged.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin, actorId } = ctx;

  try {
    const id = requireUuid((await params).id, 'invoice');
    const body = await readJson(request);
    if (typeof body.archived !== 'boolean') throw new BillingInputError('archived must be true or false');

    const { data: head, error: readError } = await admin.from('invoices')
      .select('customer_id, number, state, archived_at').eq('id', id).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!head) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    if (body.archived && head.state !== 'void') {
      throw new BillingRuleError(`Only a voided invoice can be archived; ${head.number ?? 'this draft'} is ${head.state}.`);
    }
    if (body.archived === (head.archived_at !== null)) return NextResponse.json({ ok: true, unchanged: true });

    const { error } = await admin.from('invoices')
      .update({ archived_at: body.archived ? new Date().toISOString() : null }).eq('id', id);
    ruleOrThrow(error);

    await recordBillingEvent(admin, {
      customerId: head.customer_id, actorId, invoiceId: id,
      kind: body.archived ? EVENT_KIND.invoiceArchived : EVENT_KIND.invoiceUnarchived,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failureResponse('archive invoice', error);
  }
}
