import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow } from '@/lib/billing/route-helpers';
import { requireText, requireUuid } from '@/lib/billing/validate';

// A dated note on the account: a payment promise, who was spoken to, why a
// figure is what it is. Append-only.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin, actorId } = ctx;

  try {
    const customerId = requireUuid((await params).id, 'customer');
    const body = await readJson(request);
    const text = requireText(body.body, 'note');

    const { error } = await admin.from('billing_notes').insert({ customer_id: customerId, body: text, created_by: actorId });
    ruleOrThrow(error);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failureResponse('add note', error);
  }
}
