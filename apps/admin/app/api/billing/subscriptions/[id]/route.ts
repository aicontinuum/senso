import { NextResponse } from 'next/server';
import { requireAdmin, isDenied, readJson, failureResponse, ruleOrThrow } from '@/lib/billing/route-helpers';
import { EVENT_KIND, recordBillingEvent, recordOverrides } from '@/lib/billing/events';
import { loadSettings, SUBSCRIPTION_COLUMNS, toSubscription, type SubscriptionRow } from '@/lib/billing/detail';
import { parseSubscriptionInput, proposalFor } from '@/lib/billing/subscription-input';
import { effectiveMonthly, midTermAdjustment, wholeMonthsRemaining } from '@/lib/billing/pricing';
import { optionalDate, optionalText, requireUuid } from '@/lib/billing/validate';
import { todayIso } from '@/lib/format';

// Edit a plan, or end it. Every field that moves is logged as an override.
// When the monthly figure changes mid-term the response carries the suggested
// adjustment (difference × whole months left) so the admin can raise it as an
// invoice in one click; nothing is invoiced here.

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  const { admin, actorId } = ctx;

  try {
    const id = requireUuid((await params).id, 'subscription');
    const body = await readJson(request);

    const { data: current, error: readError } = await admin
      .from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('id', id).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    const before = toSubscription(current as unknown as SubscriptionRow);

    // Ending a plan is its own small action, with no other field in the body.
    if ('endedAt' in body && Object.keys(body).every(k => k === 'endedAt' || k === 'reason')) {
      const endedAt = optionalDate(body.endedAt, 'end date');
      const reason = optionalText(body.reason, 'reason');
      const { error } = await admin.from('subscriptions').update({ ended_at: endedAt, updated_at: new Date().toISOString() }).eq('id', id);
      ruleOrThrow(error);
      await recordBillingEvent(admin, {
        customerId: before.customerId, actorId, kind: EVENT_KIND.subscriptionEnded, subscriptionId: id,
        oldValue: before.endedAt, newValue: endedAt, reason,
      });
      return NextResponse.json({ ok: true });
    }

    const settings = await loadSettings(admin);
    const input = parseSubscriptionInput(body, settings);

    const { data, error } = await admin
      .from('subscriptions')
      .update({
        label: input.label,
        tier: input.tier,
        sensor_count: input.sensorCount,
        addon_count: input.addonCount,
        addon_monthly_rate: input.addonMonthlyRate,
        term_months: input.termMonths,
        monthly_rate: input.monthlyRate,
        term_total: input.termTotal,
        term_start: input.termStart,
        renewal_date: input.renewalDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(SUBSCRIPTION_COLUMNS)
      .single();
    ruleOrThrow(error);
    const after = toSubscription(data as unknown as SubscriptionRow);

    await recordOverrides(
      admin,
      { customerId: before.customerId, actorId, subscriptionId: id, reason: input.reason },
      {
        label: before.label, tier: before.tier, sensor_count: before.sensorCount, addon_count: before.addonCount,
        addon_monthly_rate: before.addonMonthlyRate, term_months: before.termMonths, monthly_rate: before.monthlyRate,
        term_total: before.termTotal, term_start: before.termStart, renewal_date: before.renewalDate,
      },
      {
        label: after.label, tier: after.tier, sensor_count: after.sensorCount, addon_count: after.addonCount,
        addon_monthly_rate: after.addonMonthlyRate, term_months: after.termMonths, monthly_rate: after.monthlyRate,
        term_total: after.termTotal, term_start: after.termStart, renewal_date: after.renewalDate,
      },
    );

    const oldMonthly = effectiveMonthly(before.monthlyRate, before.addonCount, before.addonMonthlyRate);
    const newMonthly = effectiveMonthly(after.monthlyRate, after.addonCount, after.addonMonthlyRate);
    const monthsRemaining = after.renewalDate ? wholeMonthsRemaining(todayIso(), after.renewalDate) : 0;
    const adjustment = midTermAdjustment(oldMonthly, newMonthly, monthsRemaining);

    return NextResponse.json({
      subscription: after,
      proposal: proposalFor(settings, input),
      suggestedAdjustment: adjustment === 0 ? null : {
        amount: adjustment,
        monthlyDifference: newMonthly - oldMonthly,
        monthsRemaining,
      },
    });
  } catch (error) {
    return failureResponse('update subscription', error);
  }
}
