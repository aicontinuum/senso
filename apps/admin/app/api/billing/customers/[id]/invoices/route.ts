import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow } from '@/lib/billing/route-helpers';
import { loadSettings } from '@/lib/billing/detail';
import { parseLines } from '@/lib/billing/invoice-lines';
import { optionalDate, optionalUuid, requireInvoiceType, requireUuid } from '@/lib/billing/validate';
import { plusDays, todayIso } from '@/lib/format';

// Start a draft. It opens empty unless the body carries lines (a mid-term
// adjustment does); the editor fills it from the plan with one click and
// sets the type and plan then. The due date is proposed as today plus the
// payment terms and the tax rate is copied from settings at this moment, so
// a later rate change never touches an existing invoice. No event is
// written for a draft: it is scratch paper until it is issued.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin } = ctx;

  try {
    const customerId = requireUuid((await params).id, 'customer');
    const body = await readJson(request).catch(() => ({} as Record<string, unknown>));
    const type = body.type === undefined ? 'adjustment' : requireInvoiceType(body.type);
    const subscriptionId = optionalUuid(body.subscriptionId, 'subscription');
    const settings = await loadSettings(admin);

    if (subscriptionId) {
      const { data, error } = await admin.from('subscriptions').select('id')
        .eq('id', subscriptionId).eq('customer_id', customerId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const dueOn = optionalDate(body.dueOn, 'due date') ?? plusDays(todayIso(), settings.paymentTermsDays);
    const lines = body.lines === undefined ? [] : parseLines(body.lines);

    const { data: invoice, error } = await admin
      .from('invoices')
      .insert({ customer_id: customerId, subscription_id: subscriptionId, type, due_on: dueOn, tax_rate: settings.taxRate })
      .select('id')
      .single();
    ruleOrThrow(error);
    if (!invoice) throw new Error('insert returned no row');

    if (lines.length > 0) {
      const { error: linesError } = await admin.from('invoice_lines').insert(
        lines.map((l, position) => ({
          invoice_id: invoice.id, position, description: l.description,
          quantity: l.quantity, unit_amount: l.unitAmount, amount: l.amount,
        })),
      );
      ruleOrThrow(linesError);
    }

    return NextResponse.json({ invoiceId: invoice.id });
  } catch (error) {
    return failureResponse('create invoice', error);
  }
}
