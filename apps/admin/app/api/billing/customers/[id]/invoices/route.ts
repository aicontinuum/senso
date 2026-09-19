import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow } from '@/lib/billing/route-helpers';
import { loadSettings, SUBSCRIPTION_COLUMNS, toSubscription, type SubscriptionRow } from '@/lib/billing/detail';
import { parseLines, proposeLines } from '@/lib/billing/invoice-lines';
import { optionalDate, optionalUuid, requireInvoiceType, requireUuid } from '@/lib/billing/validate';
import { todayIso } from '@/lib/format';

// Start a draft. Lines come from the body when given (a one-off charge, a
// mid-term adjustment) and are proposed from the plan otherwise. The tax rate
// is copied from settings at this moment so a later rate change never touches
// an existing invoice. No event is written for a draft: it is scratch paper
// until it is issued.

const DAY_MS = 24 * 60 * 60 * 1000;

function plusDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin } = ctx;

  try {
    const customerId = requireUuid((await params).id, 'customer');
    const body = await readJson(request);
    const type = requireInvoiceType(body.type);
    const subscriptionId = optionalUuid(body.subscriptionId, 'subscription');
    const settings = await loadSettings(admin);

    let subscription = null;
    if (subscriptionId) {
      const { data, error } = await admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS)
        .eq('id', subscriptionId).eq('customer_id', customerId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      subscription = toSubscription(data as unknown as SubscriptionRow);
    }

    const today = todayIso();
    const dueOn = optionalDate(body.dueOn, 'due date') ?? (
      type === 'onboarding' ? plusDays(today, settings.onboardingDueDays)
      : type === 'renewal' ? (subscription?.renewalDate ?? today)
      : today
    );
    const lines = body.lines === undefined ? proposeLines(settings, type, subscription) : parseLines(body.lines);

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
