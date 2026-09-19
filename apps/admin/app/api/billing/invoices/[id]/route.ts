import { NextResponse } from 'next/server';
import {
  requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow, BillingRuleError, type AdminContext,
} from '@/lib/billing/route-helpers';
import { EVENT_KIND, recordBillingEvent } from '@/lib/billing/events';
import { parseLines } from '@/lib/billing/invoice-lines';
import {
  BillingInputError, optionalDate, optionalDiscountType, optionalText, optionalUuid, requireInvoiceType, requireMoney,
  requireText, requireUuid, MAX_LABEL,
} from '@/lib/billing/validate';

// Edit or discard an invoice. A draft takes anything. An issued invoice takes
// the words only: line descriptions, due date, discount label and notes. Its
// amounts, number and type are frozen and the database says so if asked.

type InvoiceHead = { id: string; customer_id: string; state: string; type: string; number: string | null };

async function readHead(admin: AdminContext['admin'], id: string) {
  const { data, error } = await admin.from('invoices').select('id, customer_id, state, type, number').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as InvoiceHead | null;
}

const MONEY_FIELDS = ['discountType', 'discountValue', 'lines', 'type', 'subscriptionId'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin } = ctx;

  try {
    const id = requireUuid((await params).id, 'invoice');
    const body = await readJson(request);
    const head = await readHead(admin, id);
    if (!head) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    const draft = head.state === 'draft';

    if (!draft && MONEY_FIELDS.some(k => k in body)) {
      throw new BillingRuleError(`Invoice ${head.number} is issued; its amounts are frozen. Void it and issue a new one.`);
    }

    const patch: Record<string, unknown> = {};
    if ('internalNotes' in body) patch.internal_notes = optionalText(body.internalNotes, 'internal notes');
    if ('dueOn' in body) patch.due_on = optionalDate(body.dueOn, 'due date');
    if ('type' in body) patch.type = requireInvoiceType(body.type);
    if ('subscriptionId' in body) patch.subscription_id = optionalUuid(body.subscriptionId, 'subscription');

    if (draft && ('discountType' in body || 'discountValue' in body || 'discountLabel' in body)) {
      const discountType = optionalDiscountType(body.discountType);
      const discountValue = discountType === null ? null : requireMoney(body.discountValue, 'discount value');
      if (discountType === 'percent' && discountValue !== null && discountValue > 100) {
        throw new BillingRuleError('A percentage discount cannot exceed 100');
      }
      patch.discount_type = discountType;
      patch.discount_value = discountValue;
      patch.discount_label = discountType === null ? null : optionalText(body.discountLabel, 'discount label', MAX_LABEL);
    } else if ('discountLabel' in body) {
      patch.discount_label = optionalText(body.discountLabel, 'discount label', MAX_LABEL);
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from('invoices').update(patch).eq('id', id);
      ruleOrThrow(error);
    }

    if ('lines' in body) {
      const lines = parseLines(body.lines);
      const { error: delError } = await admin.from('invoice_lines').delete().eq('invoice_id', id);
      ruleOrThrow(delError);
      if (lines.length > 0) {
        const { error: insError } = await admin.from('invoice_lines').insert(
          lines.map((l, position) => ({
            invoice_id: id, position, description: l.description, quantity: l.quantity, unit_amount: l.unitAmount, amount: l.amount,
          })),
        );
        ruleOrThrow(insError);
      } else {
        // No lines left: the trigger did not run, so bring the totals to zero.
        const { error: zeroError } = await admin.rpc('refresh_invoice_totals', { p_invoice_id: id });
        ruleOrThrow(zeroError);
      }
    }

    // Rewording issued lines: one update per line, by id, description only.
    if ('lineDescriptions' in body) {
      if (!Array.isArray(body.lineDescriptions)) throw new BillingInputError('lineDescriptions must be a list');
      for (const raw of body.lineDescriptions) {
        const item = (raw ?? {}) as Record<string, unknown>;
        const lineId = requireUuid(item.id, 'line');
        const description = requireText(item.description, 'description', MAX_LABEL * 2);
        const { error } = await admin.from('invoice_lines').update({ description }).eq('id', lineId).eq('invoice_id', id);
        ruleOrThrow(error);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return failureResponse('update invoice', error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin, actorId } = ctx;

  try {
    const id = requireUuid((await params).id, 'invoice');
    const head = await readHead(admin, id);
    if (!head) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { error } = await admin.from('invoices').delete().eq('id', id);
    ruleOrThrow(error);

    // The row is gone, so the event cannot point at it; it names the draft instead.
    await recordBillingEvent(admin, {
      customerId: head.customer_id, actorId, kind: EVENT_KIND.invoiceDeleted, oldValue: 'draft invoice',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failureResponse('delete invoice', error);
  }
}
