import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow } from '@/lib/billing/route-helpers';
import { EVENT_KIND, recordBillingEvent } from '@/lib/billing/events';
import { BillingInputError, requireText, requireUuid } from '@/lib/billing/validate';

// Suspend or reactivate. Manual, with a reason, logged. Suspended means the
// customer's data keeps logging and their portal and reports are locked; the
// customer app reads `customers.status` to enforce that.

const STATUSES = ['active', 'suspended'] as const;
type ManualStatus = (typeof STATUSES)[number];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin, actorId } = ctx;

  try {
    const customerId = requireUuid((await params).id, 'customer');
    const body = await readJson(request);
    const status = body.status;
    if (typeof status !== 'string' || !(STATUSES as readonly string[]).includes(status)) {
      throw new BillingInputError('status must be active or suspended');
    }
    const reason = requireText(body.reason, 'reason');

    const { data: current, error: readError } = await admin.from('customers').select('status').eq('id', customerId).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    if (current.status === status) return NextResponse.json({ ok: true, unchanged: true });

    const { error } = await admin.from('customers').update({
      status: status as ManualStatus,
      suspended_at: status === 'suspended' ? new Date().toISOString() : null,
    }).eq('id', customerId);
    ruleOrThrow(error);

    await recordBillingEvent(admin, {
      customerId, actorId, kind: EVENT_KIND.statusChange, field: 'status', oldValue: current.status, newValue: status, reason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failureResponse('change status', error);
  }
}
